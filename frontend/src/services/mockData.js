/**
 * Mock Data Service
 * 
 * Provides 3 comprehensive mock datasets for demonstrating
 * the full SafeData pipeline: ingestion → classification → anonymization → release
 */

import { v4 as uuidv4 } from 'uuid';

// Helper to generate random dates
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
};

// Helper to pick random item from array
const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate random number in range
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * DATASET 1: Healthcare Patient Records
 * - Contains: PII, medical diagnoses, demographics, insurance info
 * - Risk Level: HIGH (sensitive health data)
 * - Good for: Demonstrating strict anonymization, k-anonymity, l-diversity
 */
export const generateHealthcareDataset = () => {
  const firstNames = ['James', 'Maria', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Patricia', 'David', 'Elizabeth', 'John', 'Susan', 'Richard', 'Jessica', 'Thomas', 'Sarah'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'];
  const states = ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana', 'West Bengal', 'Gujarat', 'Rajasthan', 'Delhi'];
  const diagnoses = ['Diabetes Type 2', 'Hypertension', 'Asthma', 'COPD', 'Heart Disease', 'Cancer', 'Arthritis', 'Depression', 'Anxiety', 'Obesity'];
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const insuranceProviders = ['Star Health', 'ICICI Lombard', 'HDFC Ergo', 'Bajaj Allianz', 'New India Assurance', 'Oriental Insurance', 'United India'];
  const departments = ['Cardiology', 'Oncology', 'Orthopedics', 'Neurology', 'Pediatrics', 'Internal Medicine', 'Emergency', 'Radiology'];
  
  const records = [];
  for (let i = 0; i < 150; i++) {
    const firstName = randomPick(firstNames);
    const lastName = randomPick(lastNames);
    const age = randomInt(18, 85);
    const gender = Math.random() > 0.5 ? 'Male' : 'Female';
    const city = randomPick(cities);
    
    records.push({
      id: i + 1,
      patientId: `P${String(i + 1).padStart(5, '0')}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@email.com`,
      phone: `+91${randomInt(7000000000, 9999999999)}`,
      aadhar: `${randomInt(1000, 9999)}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
      age,
      gender,
      city,
      state: randomPick(states),
      pincode: randomInt(400001, 800001),
      bloodType: randomPick(bloodTypes),
      diagnosis: randomPick(diagnoses),
      diagnosisDate: randomDate(new Date(2020, 0, 1), new Date(2024, 11, 31)),
      department: randomPick(departments),
      doctor: `Dr. ${randomPick(firstNames)} ${randomPick(lastNames)}`,
      visitDate: randomDate(new Date(2024, 0, 1), new Date(2024, 11, 31)),
      insuranceProvider: randomPick(insuranceProviders),
      insuranceId: `INS${randomInt(100000, 999999)}`,
      claimAmount: randomInt(5000, 500000),
      status: randomPick(['Active', 'Discharged', 'Under Treatment', 'Referred']),
      height: gender === 'Male' ? randomInt(160, 190) : randomInt(150, 175),
      weight: gender === 'Male' ? randomInt(60, 95) : randomInt(45, 75),
      allergies: Math.random() > 0.7 ? randomPick(['Penicillin', 'Sulfa', 'Latex', 'None']) : 'None',
    });
  }
  
  return {
    id: uuidv4(),
    name: 'Healthcare Patient Records',
    description: 'Hospital patient data with demographics, medical history, and insurance claims',
    category: 'Healthcare',
    source: 'City General Hospital',
    recordCount: records.length,
    createdAt: new Date().toISOString(),
    headers: Object.keys(records[0]),
    sampleData: records.slice(0, 5),
    data: records,
    expectedRiskLevel: 'High',
    sensitiveFields: ['aadhar', 'email', 'phone', 'firstName', 'lastName', 'insuranceId', 'diagnosis'],
    quasiIdentifiers: ['age', 'gender', 'city', 'state', 'pincode', 'bloodType', 'department'],
  };
};

/**
 * DATASET 2: Financial Transaction Data
 * - Contains: Transaction amounts, merchant info, categories, timestamps
 * - Risk Level: MEDIUM (financial behavior patterns)
 * - Good for: Demonstrating differential privacy, aggregation
 */
export const generateFinancialDataset = () => {
  const categories = ['Grocery', 'Electronics', 'Healthcare', 'Transport', 'Dining', 'Entertainment', 'Utilities', 'Education', 'Shopping', 'Travel'];
  const merchants = {
    'Grocery': ['BigBasket', 'Blinkit', 'Zepto', 'DMart', 'Reliance Fresh', 'More Supermarket'],
    'Electronics': ['Amazon', 'Flipkart', 'Croma', 'Reliance Digital', 'Vijay Sales'],
    'Healthcare': ['Apollo Pharmacy', 'MedPlus', 'Netmeds', '1mg', 'Practo'],
    'Transport': ['Uber', 'Ola', 'Rapido', 'Namma Yatri', 'Metro Recharge'],
    'Dining': ['Zomato', 'Swiggy', 'Dineout', 'EazyDiner', 'Restaurant Direct'],
    'Entertainment': ['Netflix', 'Amazon Prime', 'Disney+ Hotstar', 'SonyLIV', 'BookMyShow'],
    'Utilities': ['Electricity Bill', 'Water Bill', 'Gas Bill', 'Mobile Recharge', 'Broadband'],
    'Education': ['BYJU\'s', 'Unacademy', 'Vedantu', 'Coursera', 'Udemy'],
    'Shopping': ['Myntra', 'AJIO', 'Nykaa', 'Tata Cliq', 'Shoppers Stop'],
    'Travel': ['MakeMyTrip', 'Cleartrip', 'Yatra', 'Goibibo', 'IRCTC'],
  };
  const paymentModes = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet', 'Cash on Delivery'];
  const banks = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra', 'Yes Bank'];
  const cardNetworks = ['Visa', 'Mastercard', 'RuPay', 'Amex'];
  
  const records = [];
  for (let i = 0; i < 200; i++) {
    const category = randomPick(categories);
    const merchant = randomPick(merchants[category]);
    const amount = category === 'Electronics' || category === 'Travel' 
      ? randomInt(5000, 100000) 
      : randomInt(50, 10000);
    const paymentMode = randomPick(paymentModes);
    
    records.push({
      id: i + 1,
      transactionId: `TXN${Date.now()}${String(i).padStart(4, '0')}`,
      customerId: `CUST${randomInt(10000, 99999)}`,
      timestamp: randomDate(new Date(2024, 0, 1), new Date(2024, 11, 31)),
      amount,
      currency: 'INR',
      category,
      merchant,
      merchantCity: randomPick(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune']),
      paymentMode,
      bank: paymentMode === 'Credit Card' || paymentMode === 'Debit Card' || paymentMode === 'Net Banking' 
        ? randomPick(banks) 
        : null,
      cardNetwork: paymentMode === 'Credit Card' || paymentMode === 'Debit Card' 
        ? randomPick(cardNetworks) 
        : null,
      cardLast4: paymentMode === 'Credit Card' || paymentMode === 'Debit Card' 
        ? String(randomInt(1000, 9999)) 
        : null,
      upiId: paymentMode === 'UPI' 
        ? `user${randomInt(1000, 9999)}@${randomPick(['okaxis', 'oksbi', 'okicici', 'okhdfcbank', 'paytm'])}` 
        : null,
      cashback: Math.random() > 0.8 ? randomInt(10, Math.floor(amount * 0.05)) : 0,
      discount: Math.random() > 0.7 ? randomInt(50, Math.floor(amount * 0.1)) : 0,
      status: randomPick(['Success', 'Success', 'Success', 'Success', 'Failed', 'Refunded']),
      deviceType: randomPick(['Mobile', 'Desktop', 'Tablet']),
      os: randomPick(['Android', 'iOS', 'Windows', 'MacOS']),
    });
  }
  
  return {
    id: uuidv4(),
    name: 'Financial Transaction Records',
    description: 'Banking transaction data with merchant details, payment modes, and behavioral patterns',
    category: 'Financial',
    source: 'Payment Gateway Aggregator',
    recordCount: records.length,
    createdAt: new Date().toISOString(),
    headers: Object.keys(records[0]),
    sampleData: records.slice(0, 5),
    data: records,
    expectedRiskLevel: 'Medium',
    sensitiveFields: ['customerId', 'cardLast4', 'upiId'],
    quasiIdentifiers: ['merchantCity', 'category', 'paymentMode', 'deviceType', 'os', 'timestamp'],
  };
};

/**
 * DATASET 3: Employee HR Data
 * - Contains: Salaries, performance ratings, demographics, departments
 * - Risk Level: MEDIUM-HIGH (sensitive employment data)
 * - Good for: Demonstrating anonymization utility trade-offs
 */
export const generateHRDataset = () => {
  const firstNames = ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Ananya', 'Karan', 'Neha', 'Arjun', 'Divya', 'Sanjay', 'Pooja', 'Naveen', 'Kavita', 'Rohit', 'Shreya'];
  const lastNames = ['Sharma', 'Kumar', 'Singh', 'Patel', 'Reddy', 'Gupta', 'Nair', 'Iyer', 'Desai', 'Shah', 'Mehta', 'Joshi', 'Rao', 'Khanna', 'Malhotra'];
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Product', 'Customer Support', 'Legal', 'IT'];
  const roles = {
    'Engineering': ['Software Engineer', 'Senior Engineer', 'Tech Lead', 'Engineering Manager', 'DevOps Engineer'],
    'Sales': ['Sales Executive', 'Sales Manager', 'Account Executive', 'Regional Manager', 'VP Sales'],
    'Marketing': ['Marketing Associate', 'Marketing Manager', 'Content Writer', 'SEO Specialist', 'Brand Manager'],
    'HR': ['HR Associate', 'HR Manager', 'Talent Acquisition', 'HRBP', 'Director HR'],
    'Finance': ['Accountant', 'Financial Analyst', 'Finance Manager', 'Controller', 'CFO'],
    'Operations': ['Operations Associate', 'Operations Manager', 'Supply Chain Manager', 'Logistics Head'],
    'Product': ['Product Analyst', 'Product Manager', 'Senior PM', 'Director Product'],
    'Customer Support': ['Support Associate', 'Support Lead', 'Customer Success Manager'],
    'Legal': ['Legal Associate', 'Legal Counsel', 'General Counsel'],
    'IT': ['IT Support', 'System Admin', 'IT Manager', 'Security Engineer'],
  };
  const education = ['B.Tech', 'M.Tech', 'MBA', 'B.Com', 'M.Com', 'B.Sc', 'M.Sc', 'BCA', 'MCA', 'BBA', 'LLB', 'PhD'];
  const locations = ['Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Delhi NCR', 'Kolkata', 'Ahmedabad', 'Remote'];
  const employmentTypes = ['Full-time', 'Contract', 'Intern'];
  
  const records = [];
  for (let i = 0; i < 120; i++) {
    const firstName = randomPick(firstNames);
    const lastName = randomPick(lastNames);
    const department = randomPick(departments);
    const role = randomPick(roles[department]);
    const gender = Math.random() > 0.5 ? 'Male' : 'Female';
    const age = randomInt(22, 55);
    const experience = randomInt(0, 25);
    
    // Salary based on role level and experience
    let baseSalary = 300000;
    if (role.includes('Manager')) baseSalary = 1500000;
    else if (role.includes('Lead') || role.includes('Senior')) baseSalary = 1000000;
    else if (role.includes('VP') || role.includes('Director') || role.includes('CFO')) baseSalary = 3000000;
    else baseSalary = 600000;
    
    const salary = baseSalary + (experience * 50000) + randomInt(-50000, 100000);
    const bonus = Math.floor(salary * (randomInt(5, 20) / 100));
    
    records.push({
      id: i + 1,
      employeeId: `EMP${String(i + 1).padStart(4, '0')}`,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
      phone: `+91${randomInt(7000000000, 9999999999)}`,
      pan: `${randomPick(['A', 'B', 'C', 'P', 'F'])}${randomPick(['A', 'B', 'C'])}${randomPick(['B', 'C', 'D'])}P${randomInt(1000, 9999)}${randomPick(['A', 'B', 'C'])}`,
      age,
      gender,
      department,
      role,
      education: randomPick(education),
      experience,
      salary,
      bonus,
      totalCompensation: salary + bonus,
      joiningDate: randomDate(new Date(2015, 0, 1), new Date(2024, 6, 1)),
      location: randomPick(locations),
      employmentType: randomPick(employmentTypes),
      performanceRating: randomPick([3, 3, 4, 4, 4, 5, 5, 2]), // Weighted towards 3-4
      managerId: `EMP${String(randomInt(1, Math.min(i, 50))).padStart(4, '0')}`,
      isManager: roles[department].indexOf(role) >= 2,
      leaveBalance: randomInt(0, 30),
      projectsAssigned: randomInt(1, 5),
    });
  }
  
  return {
    id: uuidv4(),
    name: 'Employee HR Records',
    description: 'Human resources data with compensation, performance metrics, and career information',
    category: 'Human Resources',
    source: 'Internal HRMS System',
    recordCount: records.length,
    createdAt: new Date().toISOString(),
    headers: Object.keys(records[0]),
    sampleData: records.slice(0, 5),
    data: records,
    expectedRiskLevel: 'Medium-High',
    sensitiveFields: ['email', 'phone', 'pan', 'salary', 'bonus', 'totalCompensation', 'firstName', 'lastName'],
    quasiIdentifiers: ['age', 'gender', 'department', 'role', 'education', 'experience', 'location', 'performanceRating'],
  };
};

/**
 * Get all mock datasets
 */
export const getAllMockDatasets = () => {
  return [
    generateHealthcareDataset(),
    generateFinancialDataset(),
    generateHRDataset(),
  ];
};

/**
 * Get a specific mock dataset by category
 */
export const getMockDatasetByCategory = (category) => {
  const datasets = getAllMockDatasets();
  return datasets.find(d => d.category.toLowerCase() === category.toLowerCase());
};

/**
 * Mock dataset metadata (without full data) for listing
 */
export const getMockDatasetMetadata = () => {
  return getAllMockDatasets().map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    category: d.category,
    source: d.source,
    recordCount: d.recordCount,
    createdAt: d.createdAt,
    expectedRiskLevel: d.expectedRiskLevel,
    headers: d.headers,
    sampleData: d.sampleData,
  }));
};

/**
 * Upload mock dataset to backend
 */
export const uploadMockDataset = async (ingestionAPI, dataset) => {
  const payload = {
    dataset: dataset.data,
    metadata: {
      filename: dataset.name,
      description: dataset.description,
      category: dataset.category,
      source: dataset.source,
      originalFormat: 'json',
    },
  };
  
  return await ingestionAPI.uploadDataset(payload);
};

/**
 * Load all mock datasets into the system
 */
export const loadAllMockDatasets = async (ingestionAPI) => {
  const results = [];
  const datasets = getAllMockDatasets();
  
  for (const dataset of datasets) {
    try {
      const result = await uploadMockDataset(ingestionAPI, dataset);
      results.push({
        success: true,
        name: dataset.name,
        datasetId: result.data.datasetId,
        recordCount: dataset.recordCount,
      });
    } catch (error) {
      results.push({
        success: false,
        name: dataset.name,
        error: error.message,
      });
    }
  }
  
  return results;
};

export default {
  generateHealthcareDataset,
  generateFinancialDataset,
  generateHRDataset,
  getAllMockDatasets,
  getMockDatasetByCategory,
  getMockDatasetMetadata,
  uploadMockDataset,
  loadAllMockDatasets,
};
