const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
// Example data with sensitive information
const data = [
    { Name: "John Doe", SSN: "123-45-6789", Email: "john@example.com" },
    { Name: "Jane Smith", SSN: "987-65-4321", Email: "jane@example.com" }
];
const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "SensitiveData");
// Create the path to the test_data directory
const testDataPath = path.join(__dirname, 'test_data'); // Ensure this points to the correct directory
// Create the test_data directory if it doesn't exist
if (!fs.existsSync(testDataPath)){
    fs.mkdirSync(testDataPath, { recursive: true }); // Using recursive to ensure all directories are created
}
// Write the Excel file to the test_data directory
XLSX.writeFile(workbook, path.join(testDataPath, 'sensitive_data2.xlsx'));