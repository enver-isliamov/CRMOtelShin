




export const CRM_CODE = `/**
 * ==========================================
 *  ВЕРСИЯ CRM: 3.4.5 (Masters Address Update)
 * ==========================================
 */

// --- КОНФИГУРАЦИЯ CRM ---
const CRM_SCRIPT_VERSION = "3.4.5";
const SHEET_NAME_CLIENTS = "WebBase";
const SHEET_NAME_TEMPLATES = "Шаблоны сообщений";
const SHEET_NAME_MASTERS = "мастера";
const SHEET_NAME_HISTORY = "History";
const SHEET_NAME_ARCHIVE = "Archive";
const SHEET_NAME_LOGS = "Logs";
const ROOT_FOLDER_NAME = "TireCRMPhotos"; 
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// --- ВХОДНЫЕ ТОЧКИ ---

function doGetCRM(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", message: "CRM Service is running.", version: CRM_SCRIPT_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPostCRM(e) {
  const lock = LockService.getScriptLock();
  // Ждем меньше, чтобы не виснуть на быстрых запросах
  lock.waitLock(10000); 

  let payload = {};
  
  try {
    let requestBody;
    
    // 1. Проверяем параметры (форма)
    if (e && e.parameter && e.parameter.payload) {
      requestBody = e.parameter.payload;
    } 
    // 2. Проверяем тело (raw JSON)
    else if (e && e.postData && e.postData.contents) {
      requestBody = e.postData.contents;
    }

    if (!requestBody) throw new Error("Empty Payload in CRM request");

    try {
        payload = JSON.parse(requestBody);
    } catch (err) {
        if (requestBody.indexOf('payload=') === 0) {
             const decoded = decodeURIComponent(requestBody.substring(8).replace(/\\+/g, ' '));
             payload = JSON.parse(decoded);
        } else {
             throw new Error("JSON Parse Error");
        }
    }
    
    if (payload.payload) payload = payload.payload;

    const result = routeActionCRM(payload);
    const finalResult = (result && result.status) ? result : { status: 'success', ...result };
    
    return ContentService.createTextOutput(JSON.stringify(finalResult)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    crmLogError(ss, (payload ? payload.user : "System"), (payload ? payload.action : "Unknown"), error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- МАРШРУТИЗАТОР CRM ---
function routeActionCRM(payload) {
  const action = payload.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const user = payload.user || "System";

  switch (action) {
    case 'testconnection': return { status: 'success', message: 'Соединение ОК!', version: CRM_SCRIPT_VERSION };
    case 'getclients': return crmGetClientsAndArchive(ss);
    case 'gettemplates': return crmGetTemplatesWithDefaults(ss);
    case 'getmasters': return crmGetFullSheetData(ss, SHEET_NAME_MASTERS, 'masters');
    case 'gethistory': return crmGetHistory(ss, payload.clientId);
    case 'getarchived': return crmGetArchived(ss, payload.clientId);
    case 'getlogs': return crmGetFullSheetData(ss, SHEET_NAME_LOGS, 'logs');
    case 'getphotos': return crmGetPhotosForContract(payload.contractNumber);
    case 'add': return { status: 'success', newId: crmAddRow(ss, SHEET_NAME_CLIENTS, payload.client, user) };
    case 'update': return { status: 'success', message: crmUpdateRow(ss, SHEET_NAME_CLIENTS, payload.client, 'id', user) };
    case 'delete': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_CLIENTS, payload.clientId, 'id') };
    case 'bulkdelete': return { status: 'success', message: crmBulkDeleteRows(ss, SHEET_NAME_CLIENTS, payload.clientIds, 'id') };
    case 'reorder': return crmReorderClient(ss, payload.oldClientId, payload.client, user);
    case 'addtemplate': return { status: 'success', message: crmAddRow(ss, SHEET_NAME_TEMPLATES, payload.template, user) };
    case 'updatetemplate': return { status: 'success', message: crmUpdateTemplate(ss, payload.template) };
    case 'deletetemplate': return { status: 'success', message: crmDeleteTemplate(ss, payload.templateName) };
    case 'addmaster': return { status: 'success', message: crmAddRow(ss, SHEET_NAME_MASTERS, payload.master, user) };
    case 'updatemaster': return { status: 'success', message: crmUpdateRow(ss, SHEET_NAME_MASTERS, payload.master, 'id', user) };
    case 'deletemaster': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_MASTERS, payload.masterId, 'id') };
    
    // --- SYNC ACTIONS (Vercel -> GAS) ---
    case 'sync_client': return { status: 'success', message: crmUpsertRow(ss, SHEET_NAME_CLIENTS, payload.client, 'id', user) };
    case 'sync_delete_client': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_CLIENTS, payload.clientId, 'id') };
    case 'sync_master': return { status: 'success', message: crmUpsertRow(ss, SHEET_NAME_MASTERS, payload.master, 'id', user) };
    case 'sync_delete_master': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_MASTERS, payload.masterId, 'id') };
    case 'sync_template': return { status: 'success', message: crmUpsertRow(ss, SHEET_NAME_TEMPLATES, payload.template, 'Название шаблона', user) };
    case 'sync_delete_template': return { status: 'success', message: crmDeleteRow(ss, SHEET_NAME_TEMPLATES, payload.templateName, 'Название шаблона') };

    case 'sendMessage': return crmSendMessage(payload.chatId, payload.message);
    case 'bulksend': return crmBulkSendMessage(ss, payload.clientIds, payload.templateName);
    case 'uploadfile': return { status: 'success', fileUrl: crmUploadFile(payload), message: 'Файл загружен' };
    default: return { status: 'error', message: 'Unknown action: ' + action };
  }
}

// --- БИЗНЕС-ЛОГИКА ---

function crmGetClientsAndArchive(ss) {
  const clientsResult = crmGetFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const archiveResult = crmGetFullSheetData(ss, SHEET_NAME_ARCHIVE, 'archive');
  return { status: 'success', headers: clientsResult.headers || [], clients: clientsResult.clients || [], archive: archiveResult.archive || [] };
}

function crmGetHistory(ss, clientId) {
  try {
    const sheet = crmGetOrCreateSheet(ss, SHEET_NAME_HISTORY);
    if (sheet.getLastRow() < 2) return { status: 'success', history: [] };
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const clientIdIndex = headers.indexOf('clientId');
    if (clientIdIndex === -1) return { status: 'success', history: [] };
    const history = data.filter(row => row[clientIdIndex] == clientId).map(row => {
        let obj = {}; headers.forEach((header, i) => { obj[header] = row[i]; }); return obj;
    }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { status: 'success', history: history };
  } catch(e) { return { status: 'error', message: e.message }; }
}

function crmGetArchived(ss, clientId) {
  const clientSheet = crmGetOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const clientRowNum = crmFindRowById(clientSheet, clientId, 'id');
  if (clientRowNum === -1) return { status: 'success', orders: [] };
  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const clientData = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  const phoneIndex = clientHeaders.indexOf('Телефон');
  const clientPhone = phoneIndex > -1 ? clientData[phoneIndex] : null;
  if (!clientPhone) return { status: 'success', orders: [] }; 
  const archiveSheet = crmGetOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  if (archiveSheet.getLastRow() < 2) return { status: 'success', orders: [] };
  const data = archiveSheet.getDataRange().getValues();
  const headers = data.shift();
  const phoneIndexInArchive = headers.indexOf('Телефон');
  if (phoneIndexInArchive === -1) return { status: 'success', orders: [] };
  const orders = data.filter(row => row[phoneIndexInArchive] == clientPhone).map(row => {
      let obj = {}; headers.forEach((header, i) => { 
        let value = row[i]; if (value instanceof Date) value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"); obj[header] = value;
      }); return obj;
  }).sort((a,b) => new Date(b['Дата добавления']).getTime() - new Date(a['Дата добавления']).getTime());
  return { status: 'success', orders: orders };
}

function crmGetPhotosForContract(contractNumber) {
  if (!contractNumber) return { status: 'success', photoUrls: [] };
  try {
    const rootFolder = crmGetAppRootFolder();
    const folders = rootFolder.getFolders();
    let clientFolder = null;
    while (folders.hasNext()) { const folder = folders.next(); if (folder.getName().startsWith(contractNumber)) { clientFolder = folder; break; } }
    if (!clientFolder) return { status: 'success', photoUrls: [] };
    const photoUrls = []; const files = clientFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) { try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {} }
      photoUrls.push('https://drive.google.com/uc?export=view&id=' + file.getId());
    }
    return { status: 'success', photoUrls: photoUrls };
  } catch(e) { return { status: 'success', photoUrls: [] }; }
}

function crmBulkSendMessage(ss, clientIds, templateName) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Токен Telegram не настроен.");
  const templatesData = crmGetTemplatesWithDefaults(ss);
  const template = templatesData.templates.find(t => t['Название шаблона'] === templateName);
  if (!template) throw new Error('Шаблон "' + templateName + '" не найден.');
  const clientsData = crmGetFullSheetData(ss, SHEET_NAME_CLIENTS, 'clients');
  const clientsToSend = clientsData.clients.filter(c => clientIds.includes(c.id));
  clientsToSend.forEach(client => {
    if (client['Chat ID']) {
      let message = template['Содержимое (HTML)'];
      Object.keys(client).forEach(key => { message = message.replace(new RegExp('{{' + key + '}}', 'g'), client[key] || ''); });
      crmSendMessage(client['Chat ID'], message);
    }
  });
  return { status: "success", message: "Рассылка завершена."};
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function crmGetFullSheetData(ss, sheetName, dataKey) {
  try {
    const sheet = crmGetOrCreateSheet(ss, sheetName);
    if (sheet.getLastRow() < 2) return { status: 'success', headers: [], [dataKey]: [] };
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    // Ensure 'id' exists for all rows (except logs/history which might not need it in the same way, but let's check)
    const idIndex = headers.indexOf('id');
    let hasUpdates = false;
    
    const result = data.map((row, rowIndex) => {
        let obj = {}; 
        headers.forEach((header, i) => { 
            let value = row[i]; 
            if (value instanceof Date) value = Utilities.formatDate(new Date(value), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"); 
            obj[header] = value; 
        }); 
        
        // Auto-generate ID if missing
        if (idIndex > -1 && !obj['id']) {
            const newId = (sheetName === SHEET_NAME_MASTERS ? 'm_' : 'c_') + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
            obj['id'] = newId;
            sheet.getRange(rowIndex + 2, idIndex + 1).setValue(newId);
            hasUpdates = true;
        }
        
        return obj;
    });
    
    if (sheetName === SHEET_NAME_LOGS) result.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { status: 'success', headers: headers, [dataKey]: result };
  } catch (e) { throw new Error('Could not get data from sheet: ' + sheetName); }
}

function crmGetOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  sheet = ss.insertSheet(sheetName);
  const defaultHeaders = {
    [SHEET_NAME_CLIENTS]: ['id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто', 'Заказ - QR', 'Бренд_Модель', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков', 'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка', 'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки', 'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls'],
    [SHEET_NAME_ARCHIVE]: ['id', 'Дата добавления', 'Chat ID', 'Имя клиента', 'Телефон', 'Номер Авто', 'Заказ - QR', 'Бренд_Модель', 'Размер шин', 'Сезон', 'Цена за месяц', 'Кол-во шин', 'Наличие дисков', 'Начало', 'Срок', 'Напомнить', 'Окончание', 'Склад хранения', 'Ячейка', 'Общая сумма', 'Долг', 'Договор', 'Адрес клиента', 'Статус сделки', 'Источник трафика', 'Услуга: Вывоз', 'Услуга: Мойка', 'Услуга: Упаковка', 'photoUrls', 'Дата архивации'],
    [SHEET_NAME_TEMPLATES]: ['Название шаблона', 'Содержимое (HTML)'],
    [SHEET_NAME_MASTERS]: ['id', 'Имя', 'chatId (Telegram)', 'Услуга', 'Телефон', 'Адрес'],
    [SHEET_NAME_HISTORY]: ['id', 'clientId', 'timestamp', 'user', 'action', 'details'],
    [SHEET_NAME_LOGS]: ['timestamp', 'level', 'user', 'action', 'message', 'details']
  };
  if (defaultHeaders[sheetName]) { sheet.appendRow(defaultHeaders[sheetName]); sheet.setFrozenRows(1); sheet.getRange(1, 1, 1, defaultHeaders[sheetName].length).setFontWeight("bold"); }
  return sheet;
}

function crmFindRowById(sheet, id, idKey) {
  if (!id) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColIndex = headers.indexOf(idKey);
  if (idColIndex === -1) return -1;
  const data = sheet.getRange(2, idColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) { if (String(data[i][0]) === String(id)) return i + 2; }
  return -1;
}

function crmAddRow(ss, sheetName, dataObject, user) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(header => dataObject[header] === undefined ? '' : dataObject[header]);
  sheet.appendRow(newRow);
  const action = sheetName === SHEET_NAME_CLIENTS ? 'Клиент создан' : 'Запись добавлена';
  const clientId = sheetName === SHEET_NAME_CLIENTS ? dataObject.id : null;
  const details = Object.entries(dataObject).map(([key, value]) => key + ': ' + value).join('\\n');
  crmLogHistory(ss, clientId, user, action, details);
  return dataObject.id;
}

function crmUpdateRow(ss, sheetName, dataObject, idKey, user) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowNum = crmFindRowById(sheet, dataObject[idKey], idKey);
  if (rowNum === -1) throw new Error('Update failed: ID not found');
  const oldDataValues = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  const oldData = headers.reduce((obj, header, i) => ({...obj, [header]: oldDataValues[i]}), {});
  const newRow = headers.map(header => dataObject[header] !== undefined ? dataObject[header] : oldData[header]);
  sheet.getRange(rowNum, 1, 1, newRow.length).setValues([newRow]);
  const changes = headers.map(header => ({ header, old: oldData[header], new: dataObject[header] })).filter(({ old, new: newValue }) => newValue !== undefined && String(old) !== String(newValue)).map(({header, old, new: newValue}) => header + ": '" + old + "' -> '" + newValue + "'");
  if (changes.length > 0 && sheetName === SHEET_NAME_CLIENTS) { crmLogHistory(ss, dataObject.id, user, 'Данные обновлены', changes.join('\\n')); }
  return 'Updated';
}

function crmUpsertRow(ss, sheetName, dataObject, idKey, user) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const rowNum = crmFindRowById(sheet, dataObject[idKey], idKey);
  if (rowNum === -1) {
    crmAddRow(ss, sheetName, dataObject, user);
    return 'Inserted';
  } else {
    crmUpdateRow(ss, sheetName, dataObject, idKey, user);
    return 'Updated';
  }
}

function crmDeleteRow(ss, sheetName, id, idKey) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const rowNum = crmFindRowById(sheet, id, idKey);
  if (rowNum > -1) { sheet.deleteRow(rowNum); return 'Deleted'; }
  return 'Not found';
}

function crmBulkDeleteRows(ss, sheetName, ids, idKey) {
  const sheet = crmGetOrCreateSheet(ss, sheetName);
  const data = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf(idKey);
  const rows = [];
  for (let i = data.length - 1; i >= 1; i--) if (ids.includes(String(data[i][idCol]))) rows.push(i + 1);
  rows.forEach(r => sheet.deleteRow(r));
  return rows.length + ' записей удалено.';
}

function crmReorderClient(ss, oldClientId, newClientData, user) {
  const clientSheet = crmGetOrCreateSheet(ss, SHEET_NAME_CLIENTS);
  const archiveSheet = crmGetOrCreateSheet(ss, SHEET_NAME_ARCHIVE);
  const clientRowNum = crmFindRowById(clientSheet, oldClientId, 'id');
  if (clientRowNum === -1) throw new Error('Не удалось найти клиента: ' + oldClientId);
  const clientHeaders = clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0];
  const oldClientDataValues = clientSheet.getRange(clientRowNum, 1, 1, clientHeaders.length).getValues()[0];
  const archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
  const newArchiveRow = archiveHeaders.map(header => {
    const idx = clientHeaders.indexOf(header); if (header === 'Дата архивации') return new Date().toISOString(); if (idx > -1) return oldClientDataValues[idx]; return '';
  });
  archiveSheet.appendRow(newArchiveRow);
  const newRowValues = clientHeaders.map((header, index) => { if (newClientData[header] !== undefined) return newClientData[header]; return oldClientDataValues[index]; });
  clientSheet.getRange(clientRowNum, 1, 1, newRowValues.length).setValues([newRowValues]);
  crmLogHistory(ss, oldClientId, user, 'Заказ архивирован', 'Перенос в архив');
  crmLogHistory(ss, newClientData.id, user, 'Новый заказ создан', 'Обновление записи');
  return { status: 'success', message: 'Заказ успешно переоформлен.', newId: newClientData.id };
}

// --- TELEGRAM И ФАЙЛЫ ---
function crmSendMessage(chatId, message) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error("Токен Telegram не настроен.");
  const sanitizedMessage = message.replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/p>/gi, '\\n').replace(/<p.*?>/gi, '').replace(/&nbsp;/g, ' ').trim();
  
  const payload = { 
    chat_id: String(chatId), 
    text: sanitizedMessage, 
    parse_mode: "HTML" 
  };

  // AUTOMATIC BUTTON INJECTION FOR RECEIPT
  if (message.indexOf('ДЕТАЛИ ЗАКАЗА') !== -1) {
     payload.reply_markup = {
        inline_keyboard: [
           [{ text: "📱 Личный кабинет", url: "https://t.me/OtelShinBot/panel" }]
        ]
     };
  }

  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
  return { status: "success", message: "Sent" };
}

function crmGetTemplatesWithDefaults(ss) {
  const sheet = crmGetOrCreateSheet(ss, SHEET_NAME_TEMPLATES);
  const defaultTemplates = { 
    'Напоминание о задолженности': 'Здравствуйте, {{Имя клиента}}! Долг по договору №{{Договор}}: <b>{{Долг}} ₽</b>.', 
    'Напоминание об окончании хранения': 'Здравствуйте, {{Имя клиента}}! Срок хранения шин (дог. №{{Договор}}) истекает <b>{{Окончание}}</b>.',
    'Чек (Детали заказа)': '<b>📃 ДЕТАЛИ ЗАКАЗА (ДОГОВОР)</b>\\n\\n👤 <b>Клиент:</b> {{Имя клиента}}\\n🚗 <b>Авто:</b> {{Номер Авто}}\\n📞 <b>Телефон:</b> {{Телефон}}\\n\\n🔢 <b>Договор №:</b> <code>{{Договор}}</code>\\n📅 <b>Срок хранения:</b> {{Срок}} мес.\\n(с {{Начало}} по {{Окончание}})\\n\\n- - - - - - - - - - - - - -\\n{{Заказ - QR}}\\nДиски: <b>{{Наличие дисков}}</b> | DOT: <b>{{DOT-код}}</b>\\n- - - - - - - - - - - - - -\\n\\n💰 <b>Сумма заказа:</b> {{Общая сумма}}\\n(Тариф: {{Цена за месяц}}/мес)\\n\\n📍 <b>Склад:</b> {{Склад хранения}}\\n\\n<i>Приём и хранение осуществляется на условиях публичной оферты otelshin.ru/dogovor</i>'
  };
  const data = sheet.getDataRange().getValues();
  const existingTemplates = data.length > 1 ? data.slice(1).map(row => row[0]) : [];
  const templatesToAdd = []; for (const name in defaultTemplates) { if (!existingTemplates.includes(name)) templatesToAdd.push([name, defaultTemplates[name]]); }
  if (templatesToAdd.length > 0) sheet.getRange(sheet.getLastRow() + 1, 1, templatesToAdd.length, 2).setValues(templatesToAdd);
  return crmGetFullSheetData(ss, SHEET_NAME_TEMPLATES, 'templates');
}

function crmUpdateTemplate(ss, t) { return crmUpdateRow(ss, SHEET_NAME_TEMPLATES, t, 'Название шаблона', 'System'); }
function crmDeleteTemplate(ss, name) { return crmDeleteRow(ss, SHEET_NAME_TEMPLATES, name, 'Название шаблона'); }

function crmGetAppRootFolder() {
  let folderId = SCRIPT_PROPERTIES.getProperty('ROOT_FOLDER_ID');
  if (folderId) { try { return DriveApp.getFolderById(folderId); } catch(e) {} }
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
  SCRIPT_PROPERTIES.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function crmUploadFile(payload) {
  const root = crmGetAppRootFolder();
  const name = payload.client['Договор'] ? (payload.client['Договор'] + '_' + payload.client['Имя клиента']) : payload.client.id;
  const folders = root.getFoldersByName(name);
  const folder = folders.hasNext() ? folders.next() : root.createFolder(name);
  const blob = Utilities.newBlob(Utilities.base64Decode(payload.fileData), payload.mimeType, payload.filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function crmLogHistory(ss, clientId, user, action, details) {
  try { const s = crmGetOrCreateSheet(ss, SHEET_NAME_HISTORY); s.appendRow(["evt_" + new Date().getTime(), clientId || 'N/A', new Date().toISOString(), user || 'System', action, details]); } catch (e) {}
}

function crmLogError(ss, user, action, error) {
  try { const s = crmGetOrCreateSheet(ss, SHEET_NAME_LOGS); s.appendRow([new Date().toISOString(), "ERROR", user, action, error.message, error.stack]); } catch (e) { Logger.log(e); }
}
`;

export const ROUTER_CODE = `/**
 * ГЛАВНЫЙ МАРШРУТИЗАТОР (ROUTER)
 * 
 * Этот файл является входной точкой (entry point) веб-приложения.
 * Он определяет, пришел ли запрос от CRM (React app) или от Telegram (Webhook),
 * и направляет его в соответствующий файл.
 */

function doGet(e) {
  // GET запросы в основном используются для проверки доступности
  return doGetCRM(e);
}

function doPost(e) {
  // 1. Проверяем, является ли это Webhook от Telegram
  // Telegram всегда шлет JSON, в котором есть update_id
  if (e.postData && e.postData.contents) {
    try {
      const data = JSON.parse(e.postData.contents);
      
      // Если есть update_id - это точно Телеграм
      if (data.update_id) {
         return doBot(data); // Функция из файла Bot.gs
      }
    } catch (err) {
      // Игнорируем ошибки парсинга здесь, пусть CRM разбирается
    }
  }

  // 2. Если это не бот, значит это CRM
  return doPostCRM(e); // Функция из файла Code.gs (или основного файла CRM)
}`;

export const BOT_CODE = `/**
 * ==========================================
 *  TELEGRAM BOT LOGIC
 * ==========================================
 */

// Глобальные настройки
const ADMIN_CHAT_ID_PROP = 'ADMIN_CHAT_ID'; // Нужно сохранить ID админа в свойства скрипта, если хотим уведомления
const BOT_TOKEN_PROP = 'TELEGRAM_BOT_TOKEN';

function getBotToken() {
  return PropertiesService.getScriptProperties().getProperty(BOT_TOKEN_PROP);
}

// Входная точка бота
function doBot(data) {
  const token = getBotToken();
  if (!token) {
    return ContentService.createTextOutput("Token not set");
  }

  try {
    // 1. ЗАЩИТА ОТ ДУБЛЕЙ (SPAM PROTECTION)
    // Telegram шлет повторы, если скрипт не ответил 200 OK быстро.
    // Мы запоминаем update_id в кэше и игнорируем повторы.
    if (data.update_id) {
       const cache = CacheService.getScriptCache();
       const processedKey = 'processed_' + data.update_id;
       if (cache.get(processedKey)) {
         // Уже обрабатывали этот апдейт, выходим
         return ContentService.createTextOutput("OK");
       }
       cache.put(processedKey, 'true', 600); // Помечаем как обработанный на 10 минут
    }

    if (data.message) {
      handleMessage(data.message);
    } else if (data.callback_query) {
      handleCallback(data.callback_query);
    }
  } catch (e) {
    // Логируем ошибку, но возвращаем 200 OK для Телеграма, чтобы он не слал повторы
    Logger.log("BOT ERROR: " + e.message);
  }
  
  return ContentService.createTextOutput("OK");
}

// --- КЛАВИАТУРЫ ---

function getMainMenu() {
  return {
    inline_keyboard: [
      [{text: "📝 Записаться на хранение", callback_data: "flow_signup"}],
      [{text: "👤 Личный кабинет", callback_data: "flow_lk"}],
      [{text: "💰 Цены", callback_data: "info_prices"}, {text: "ℹ️ Почему мы", callback_data: "info_why"}],
      [{text: "🔧 Шиномонтаж", callback_data: "info_fitting"}, {text: "📞 Менеджер", callback_data: "contact_manager"}]
    ]
  };
}

function getLkMenu(client) {
  return {
    inline_keyboard: [
      [{text: "📅 Продлить хранение", callback_data: "lk_extend"}],
      [{text: "🚗 Забрать шины", callback_data: "lk_pickup"}],
      [{text: "⬅️ В меню", callback_data: "main_menu"}]
    ]
  };
}

function getExtensionMenu(months, hasRims) {
  // months = 1..12
  // hasRims = boolean
  const check = hasRims ? "✅" : "⬜";
  const rows = [];
  
  // Кнопки выбора месяцев (1, 6, 12 или ручной ввод - упростим до популярных)
  rows.push([
    {text: (months===1?"✅ ":"")+"1 мес", callback_data: "ext_set_m_1"},
    {text: (months===6?"✅ ":"")+"6 мес", callback_data: "ext_set_m_6"},
    {text: (months===12?"✅ ":"")+"12 мес", callback_data: "ext_set_m_12"}
  ]);
  
  // Тоггл дисков
  rows.push([{text: check + " Хранение с дисками (+100₽)", callback_data: "ext_toggle_rims"}]);
  
  // Кнопка расчета/оплаты
  rows.push([{text: "🧮 Рассчитать и оплатить", callback_data: "ext_calc"}]);
  rows.push([{text: "⬅️ Назад", callback_data: "flow_lk"}]);
  
  return { inline_keyboard: rows };
}

// --- ОБРАБОТЧИКИ СООБЩЕНИЙ ---

function handleMessage(msg) {
  // 2. ИГНОРИРОВАНИЕ БОТОВ И СЕРВИСНЫХ СООБЩЕНИЙ
  if (!msg || !msg.chat) return;
  if (msg.from && msg.from.is_bot) return; // Не разговариваем с ботами (и с собой)
  
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Если прислали не текст (стикер, фото), а мы ждем текст - игнорируем или шлем меню
  if (!text) {
     // Можно молча выйти, чтобы не спамить "я не понял" на каждый стикер
     return; 
  }

  // Проверяем состояние пользователя (для пошаговых форм)
  const state = getUserState(chatId);
  
  if (text === '/start') {
    clearUserState(chatId);
    sendText(chatId, "👋 Добро пожаловать в сервис хранения шин! Выберите действие:", getMainMenu());
    return;
  }
  
  // Обработка шагов записи
  if (state && state.startsWith('signup_')) {
    handleSignupStep(chatId, text, state);
    return;
  }
  
  // Обработка выбора даты для вывоза
  if (state === 'lk_pickup_date') {
    handlePickupDate(chatId, text);
    return;
  }

  // Дефолтный ответ (только если это приватный чат, чтобы не спамить в группах)
  if (msg.chat.type === 'private') {
    sendText(chatId, "Я вас не понял. Нажмите /start для меню.");
  }
}

// --- ОБРАБОТЧИКИ КНОПОК ---

function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data;
  
  // 1. Навигация
  if (data === 'main_menu') {
    clearUserState(chatId);
    editMessage(chatId, messageId, "Главное меню:", getMainMenu());
    return;
  }
  
  // 2. Инфо разделы
  if (data === 'info_prices') {
    const text = "💰 **Наши цены:**\\n\\nR13-R15: 500₽/мес\\nR16-R19: 600₽/мес\\nR20+: 700₽/мес\\n\\nС дисками: +100₽/мес за комплект.";
    editMessage(chatId, messageId, text, {inline_keyboard: [[{text: "⬅️ Назад", callback_data: "main_menu"}]]});
    return;
  }
  
  if (data === 'info_why') {
    const text = "🏆 **Почему мы?**\\n\\n✅ Теплый склад\\n✅ Страховка шин\\n✅ Мойка и упаковка\\n✅ Доставка";
    editMessage(chatId, messageId, text, {inline_keyboard: [[{text: "⬅️ Назад", callback_data: "main_menu"}]]});
    return;
  }

  if (data === 'info_fitting') {
     const text = "🔧 **Шиномонтаж**\\n\\nМы работаем с партнерами по всему городу. Также доступен выездной шиномонтаж.\\nНажмите кнопку ниже, чтобы связаться с менеджером для записи.";
     editMessage(chatId, messageId, text, {inline_keyboard: [[{text: "📞 Записаться через менеджера", callback_data: "contact_manager"}, {text: "⬅️ Назад", callback_data: "main_menu"}]]});
     return;
  }
  
  if (data === 'contact_manager') {
    sendText(chatId, "Менеджер скоро свяжется с вами! (тут ссылка на контакт: @ManagerLink)");
    return;
  }

  // 3. Запись на хранение (Flow)
  if (data === 'flow_signup') {
    setUserState(chatId, 'signup_phone');
    editMessage(chatId, messageId, "✍️ **Запись на хранение**\\n\\nШаг 1/3. Введите ваш номер телефона (+7...):");
    return;
  }
  
  // 4. Личный кабинет
  if (data === 'flow_lk') {
    const client = findClientByChatId(chatId);
    if (client) {
      const text = \`👤 **Личный кабинет**\\n\\nКлиент: \${client['Имя клиента']}\\nАвто: \${client['Номер Авто']}\\nДоговор: \${client['Договор']}\\nШины: \${client['Заказ - QR'] || 'Не указано'}\\nСрок до: \${formatDate(client['Окончание'])}\`;
      editMessage(chatId, messageId, text, getLkMenu(client));
    } else {
      editMessage(chatId, messageId, "❌ Клиент с таким Chat ID не найден в базе.\\n\\nЕсли вы уже наш клиент, попросите менеджера привязать ваш Telegram (ID: " + chatId + ").", {inline_keyboard: [[{text: "⬅️ В меню", callback_data: "main_menu"}]]});
    }
    return;
  }
  
  // 5. Продление (Extension)
  if (data === 'lk_extend') {
    // Инициализируем стейт продления (по умолчанию 1 мес, без дисков)
    const extState = { months: 1, hasRims: false };
    setTempState(chatId, 'ext_data', extState);
    editMessage(chatId, messageId, "📅 **Продление хранения**\\n\\nВыберите срок и опции:", getExtensionMenu(1, false));
    return;
  }
  
  if (data.startsWith('ext_set_m_')) {
    const months = parseInt(data.split('_')[3]);
    const extState = getTempState(chatId, 'ext_data') || { months: 1, hasRims: false };
    extState.months = months;
    setTempState(chatId, 'ext_data', extState);
    editMessage(chatId, messageId, "📅 **Продление хранения**\\n\\nСрок изменен.", getExtensionMenu(months, extState.hasRims));
    return;
  }
  
  if (data === 'ext_toggle_rims') {
    const extState = getTempState(chatId, 'ext_data') || { months: 1, hasRims: false };
    extState.hasRims = !extState.hasRims;
    setTempState(chatId, 'ext_data', extState);
    editMessage(chatId, messageId, "📅 **Продление хранения**\\n\\nОпции изменены.", getExtensionMenu(extState.months, extState.hasRims));
    return;
  }
  
  if (data === 'ext_calc') {
    const client = findClientByChatId(chatId);
    if (!client) return;
    const extState = getTempState(chatId, 'ext_data');
    
    // Простая логика цены (берем цену за месяц из карточки клиента или дефолт 500)
    let basePrice = client['Цена за месяц'] || 2000; // за комплект
    // Если цена в базе указана за комплект за месяц
    // Если есть диски, накидываем 100р/мес (или 400р за комплект, зависит от бизнес логики). 
    // Предположим +400р к месячной цене комплекта.
    if (extState.hasRims) basePrice += 400;
    
    const total = basePrice * extState.months;
    
    const text = \`💵 **К оплате**\\n\\nСрок: \${extState.months} мес.\\nДиски: \${extState.hasRims ? 'Да' : 'Нет'}\\n\\n**Итого: \${total} ₽**\\n\\nПереведите по номеру +79990000000 (Сбер) и пришлите чек менеджеру.\`;
    editMessage(chatId, messageId, text, {inline_keyboard: [[{text: "⬅️ В ЛК", callback_data: "flow_lk"}]]});
    return;
  }
  
  // 6. Забрать шины (Pickup)
  if (data === 'lk_pickup') {
     setUserState(chatId, 'lk_pickup_date');
     editMessage(chatId, messageId, "🚗 **Забрать шины**\\n\\nНапишите желаемую дату и время (например: Завтра в 14:00):", {inline_keyboard: [[{text: "⬅️ Отмена", callback_data: "flow_lk"}]]});
     return;
  }
  
  // Подтверждаем колбэк чтобы колесико не крутилось
  answerCallback(cb.id);
}

// --- ЛОГИКА ШАГОВ (SIGNUP) ---

function handleSignupStep(chatId, text, state) {
  if (state === 'signup_phone') {
    setTempState(chatId, 'signup_phone', text);
    setUserState(chatId, 'signup_car');
    sendText(chatId, "✅ Принято.\\nШаг 2/3. Введите номер авто (или отправьте - если нет):");
  } else if (state === 'signup_car') {
    setTempState(chatId, 'signup_car', text);
    setUserState(chatId, 'signup_district');
    sendText(chatId, "✅ Принято.\\nШаг 3/3. Укажите ваш район (для логистики):");
  } else if (state === 'signup_district') {
    const phone = getTempState(chatId, 'signup_phone');
    const car = getTempState(chatId, 'signup_car');
    const district = text;
    
    // Отправка заявки менеджеру
    const adminChatId = PropertiesService.getScriptProperties().getProperty('ADMIN_CHAT_ID') || chatId; // Шлем самому себе если админ не настроен
    
    const report = \`🔥 **Новая заявка (Бот)**\\n\\nТел: \${phone}\\nАвто: \${car}\\nРайон: \${district}\\nChatID: \${chatId}\`;
    sendText(adminChatId, report);
    
    clearUserState(chatId);
    sendText(chatId, "✅ **Заявка отправлена!**\\nМенеджер свяжется с вами в ближайшее время.", getMainMenu());
  }
}

function handlePickupDate(chatId, text) {
   const client = findClientByChatId(chatId);
   const clientName = client ? client['Имя клиента'] : 'Неизвестный';
   
   const adminChatId = PropertiesService.getScriptProperties().getProperty('ADMIN_CHAT_ID') || chatId;
   const report = \`📤 **Заявка на выдачу**\\n\\nКлиент: \${clientName}\\nКогда: \${text}\\nChatID: \${chatId}\`;
   
   sendText(adminChatId, report);
   clearUserState(chatId);
   sendText(chatId, "✅ Заявка на выдачу принята. Ждите подтверждения.", getLkMenu(client));
}

// --- БД И УТИЛИТЫ ---

function findClientByChatId(chatId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("WebBase");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const chatCol = headers.indexOf("Chat ID");
  
  // Ищем с конца, чтобы найти самый свежий заказ
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][chatCol]) == String(chatId)) {
      const client = {};
      headers.forEach((h, idx) => client[h] = data[i][idx]);
      return client;
    }
  }
  return null;
}

// State Management via CacheService (храним 10 минут)
function getUserState(chatId) {
  return CacheService.getScriptCache().get('state_' + chatId);
}
function setUserState(chatId, state) {
  CacheService.getScriptCache().put('state_' + chatId, state, 600);
}
function clearUserState(chatId) {
  CacheService.getScriptCache().remove('state_' + chatId);
}

// Temp Data via Cache (храним JSON string)
function setTempState(chatId, key, val) {
  // Используем префикс, чтобы не путать с userState
  const fullKey = 'data_' + chatId + '_' + key;
  const valStr = (typeof val === 'object') ? JSON.stringify(val) : String(val);
  CacheService.getScriptCache().put(fullKey, valStr, 600);
}
function getTempState(chatId, key) {
  const fullKey = 'data_' + chatId + '_' + key;
  const valStr = CacheService.getScriptCache().get(fullKey);
  if (!valStr) return null;
  try { return JSON.parse(valStr); } catch(e) { return valStr; }
}

// --- TELEGRAM API WRAPPERS ---

function sendText(chatId, text, keyboard) {
  const token = getBotToken();
  const payload = {
    chat_id: String(chatId),
    text: text,
    parse_mode: 'Markdown'
  };
  if (keyboard) payload.reply_markup = keyboard;
  
  UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function editMessage(chatId, messageId, text, keyboard) {
  const token = getBotToken();
  const payload = {
    chat_id: String(chatId),
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown'
  };
  if (keyboard) payload.reply_markup = keyboard;
  
  try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/editMessageText", {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch (e) {
    // Иногда редактирование падает если текст не изменился, это норм
  }
}

function answerCallback(callbackQueryId) {
   const token = getBotToken();
   UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/answerCallbackQuery", {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU");
  } catch (e) { return dateStr; }
}`;
