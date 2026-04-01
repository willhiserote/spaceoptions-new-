const SPREADSHEET_ID = '1QfkYtx-93v7xo0sm8FNk8nkoQict_RPxjigbk6t7UQM';  // ← Your sheet is already here
const SECRET_KEY = 'spaceoptions2026';  // You can change this if you want

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getInventory') {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Inventory') || 
                  SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0]; // fallback to first sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const items = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(items)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getLog') {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Activity Log') || 
                  SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[1];
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const logs = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    }).reverse();
    return ContentService.createTextOutput(JSON.stringify(logs)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.getDataAsString());
    if (payload.secret !== SECRET_KEY) throw new Error('Unauthorized');

    const action = payload.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'restock' || action === 'adjustStock' || action === 'addNewItem') {
      let result;
      if (action === 'restock') result = updateStock(ss, payload, 'Restock');
      else if (action === 'adjustStock') result = updateStock(ss, payload, 'Adjust');
      else if (action === 'addNewItem') result = addNewItem(ss, payload);
      
      logAction(ss, payload, result ? result.newStock : payload.currentStock);
      
      return ContentService.createTextOutput(JSON.stringify({success: true, data: result})).setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error('Invalid action');
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateStock(ss, payload, type) {
  const inventorySheet = ss.getSheetByName('Inventory') || ss.getSheets()[0];
  const data = inventorySheet.getDataRange().getValues();
  const idRow = data.findIndex(row => row[0] === payload.itemId);
  
  if (idRow === -1) throw new Error('Item not found');
  
  const currentStock = Number(data[idRow][4]) || 0;  // Assuming column E (index 4) is Current Stock
  let newStock = type === 'Restock' ? currentStock + Number(payload.quantity) : Number(payload.quantity);
  
  inventorySheet.getRange(idRow + 1, 5).setValue(newStock);   // Column E
  inventorySheet.getRange(idRow + 1, 9).setValue(new Date()); // Column I - Last Updated
  
  return { itemId: payload.itemId, newStock: newStock };
}

function addNewItem(ss, payload) {
  const inventorySheet = ss.getSheetByName('Inventory') || ss.getSheets()[0];
  inventorySheet.appendRow([
    payload.itemId,
    payload.productName,
    payload.category || '',
    payload.description || '',
    payload.currentStock,
    payload.unit || 'units',
    payload.reorderLevel || 5,
    payload.price || 49.99,
    new Date()
  ]);
  return { itemId: payload.itemId, newStock: payload.currentStock };
}

function logAction(ss, payload, newStock) {
  let logSheet = ss.getSheetByName('Activity Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Activity Log');
    logSheet.appendRow(['Timestamp', 'Action Type', 'Item ID', 'Product Name', 'Quantity Change', 'New Stock Level', 'Notes', 'Performed By']);
  }
  
  logSheet.appendRow([
    new Date(),
    payload.action === 'restock' ? 'Restock' : payload.action === 'adjustStock' ? 'Stock Adjusted' : 'New Item Added',
    payload.itemId || '',
    payload.productName || '',
    payload.quantity || payload.currentStock || 0,
    newStock || payload.currentStock || 0,
    payload.notes || '',
    'Admin'
  ]);
}
