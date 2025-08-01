# 🏥 Patient Management System

Multi-tenant patient management system for Naina HealthScribe with provider-level data isolation.

## 🏗️ Architecture

### **Multi-Tenant Data Model**
```typescript
interface Patient {
    patientId: string;          // PK: UUID
    providerId: string;         // GSI: Provider isolation
    patientName: string;        // Patient's full name
    dateOfBirth?: string;       // Optional DOB
    mrn?: string;              // Medical Record Number
    // ... additional fields
}
```

### **DynamoDB Table Structure**
- **Primary Key**: `patientId` (UUID)
- **GSI 1**: `providerId-patientName-index` (for autosuggest)
- **GSI 2**: `providerId-lastEncounterDate-index` (for recent patients)

## 🎯 Components

### **PatientAutosuggest**
Enhanced autosuggest component with:
- Real-time patient search for current provider
- "Create new patient" option when no matches found
- Patient selection with metadata display
- Provider-level data isolation

```tsx
<PatientAutosuggest
    value={patientName}
    onChange={handlePatientChange}
    onPatientSelect={handlePatientSelect}
    placeholder="Enter patient name"
/>
```

### **CreatePatientModal**
Modal for creating new patients with:
- Required: Patient name
- Optional: DOB, MRN, contact info, demographics
- Form validation and error handling
- Provider association

## 🔧 API Functions

### **Patient CRUD Operations**
```typescript
// Create new patient
const patient = await createPatient(providerId, patientData);

// Search provider's patients
const patients = await getProviderPatients(providerId, searchTerm);

// Get specific patient (with authorization)
const patient = await getPatientById(patientId, providerId);

// Update patient info
const updated = await updatePatient(patientId, providerId, updates);

// Update encounter statistics
await updatePatientEncounterInfo(patientId, providerId, encounterDate);
```

## 🚀 Deployment

### **1. Deploy Infrastructure**
```bash
# Deploy DynamoDB table and IAM roles
./scripts/deploy-patients-table.sh dev
```

### **2. Update Application Config**
Update your application configuration with the deployed table name:
```typescript
const PATIENTS_TABLE = 'NainaHealthScribe-Patients-dev';
```

### **3. IAM Permissions**
Ensure your application has access to:
- DynamoDB table operations
- GSI queries
- Provider-scoped access

## 🔒 Security & Compliance

### **Multi-Tenant Isolation**
- All operations scoped to `providerId`
- No cross-provider data access
- Authorization checks on all operations

### **HIPAA Compliance**
- Encryption at rest and in transit
- Audit logging for all operations
- Soft delete for data retention
- Point-in-time recovery enabled

### **Data Privacy**
- Provider-level data isolation
- Secure patient search
- No PII in logs or error messages

## 🎯 Usage Examples

### **Basic Patient Selection**
```tsx
const [patientName, setPatientName] = useState('New Encounter');
const [selectedPatientId, setSelectedPatientId] = useState<string>();

const handlePatientChange = (name: string, patientId?: string) => {
    setPatientName(name);
    setSelectedPatientId(patientId);
};

return (
    <PatientAutosuggest
        value={patientName}
        onChange={handlePatientChange}
        placeholder="Enter patient name"
    />
);
```

### **Patient Creation Flow**
1. User types patient name in autosuggest
2. If no matches found, "Create new patient" option appears
3. User clicks to open CreatePatientModal
4. User fills in patient details
5. New patient is created and selected automatically

## 🔄 Integration with Encounters

When creating encounters, the system:
1. Links encounter to selected patient via `patientId`
2. Updates patient's `lastEncounterDate`
3. Increments patient's `encounterCount`
4. Maintains provider-level isolation

## 📊 Performance Considerations

- **Autosuggest Debouncing**: 300ms delay to reduce API calls
- **Result Limiting**: Max 10 suggestions for performance
- **GSI Optimization**: Efficient queries using provider-based indexes
- **Client-side Filtering**: Additional filtering after DynamoDB query

## 🧪 Testing

### **Unit Tests**
- Patient API functions
- Component rendering
- Form validation
- Error handling

### **Integration Tests**
- Multi-tenant isolation
- Patient creation flow
- Autosuggest functionality
- Database operations

### **E2E Tests**
- Complete patient management workflow
- Cross-provider isolation verification
- Performance under load
