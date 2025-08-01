# 🏥 MULTI-TENANT HEALTHCARE APPLICATION ARCHITECTURE


**Project Name:** Naina HealthScribe
**Description:** Naina HealthScribe is a cloud based AI Medical Scribe application for medical Providers. Providers conduct Encounters with their Patients to generate Transcripts, Clinical Notes, and Insights. All of the cloud resources are built and deployed using IaC.
**Status:** In Development

Based on the EncounterDetails.png, here's what needs to be implemented:

## **🎯 REQUIREMENTS ANALYSIS**

### **📋 Current Issues:**
1. **❌ No Multi-Tenancy**: All providers see all encounters
2. **❌ No Patient Management**: No patient entity or relationship
3. **❌ No Provider Isolation**: No data segregation by provider
4. **❌ No Filtering**: Can't filter by patient name or status
5. **❌ Wrong Duration**: Shows job processing time, not encounter duration
6. **❌ Missing Encounter List**: No left sidebar with patient encounters

### **✅ Required Architecture:**

```
Provider (Authenticated User)
├── Patient 1
│   ├── Encounter 1 (Audio Recording + Transcript)
│   ├── Encounter 2 (Audio Recording + Transcript)
│   └── Encounter 3 (Audio Recording + Transcript)
├── Patient 2
│   ├── Encounter 1 (Audio Recording + Transcript)
│   └── Encounter 2 (Audio Recording + Transcript)
└── Patient 3
    └── Encounter 1 (Audio Recording + Transcript)
```

---

## **🏗️ PROPOSED SOLUTION ARCHITECTURE**

### **1. Data Model Enhancement**

#### **A. HealthScribe Job Tags (Immediate Solution)**
```typescript
// Enhanced job creation with multi-tenant metadata
const jobParams = {
    MedicalScribeJobName: `${providerId}-${patientId}-${encounterTimestamp}`,
    // ... existing params ...
    Tags: [
        { Key: 'ProviderId', Value: currentUser.sub }, // Cognito user ID
        { Key: 'ProviderEmail', Value: currentUser.email },
        { Key: 'PatientName', Value: patientName },
        { Key: 'PatientId', Value: patientId }, // Generated UUID
        { Key: 'EncounterDate', Value: new Date().toISOString() },
        { Key: 'EncounterDuration', Value: recordingDuration.toString() },
        { Key: 'CreatedBy', Value: 'HealthScribeDemo' }
    ]
};
```

#### **B. DynamoDB Tables (Comprehensive Solution)**
```typescript
// Table 1: Providers
interface Provider {
    providerId: string;        // PK: Cognito user sub
    email: string;
    name: string;
    specialty: string;
    createdAt: string;
    updatedAt: string;
}

// Table 2: Patients  
interface Patient {
    patientId: string;         // PK: UUID
    providerId: string;        // GSI: Provider's patients
    patientName: string;
    dateOfBirth?: string;
    createdAt: string;
    updatedAt: string;
}

// Table 3: Encounters
interface Encounter {
    encounterId: string;       // PK: UUID
    providerId: string;        // GSI: Provider's encounters
    patientId: string;         // GSI: Patient's encounters
    patientName: string;       // Denormalized for quick access
    healthScribeJobName: string; // Link to HealthScribe job
    encounterDate: string;
    encounterDuration: number; // Actual recording duration
    status: 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    audioFileUri?: string;
    transcriptUri?: string;
    clinicalNotesUri?: string;
    createdAt: string;
    updatedAt: string;
}
```

### **2. Authentication & Authorization**

#### **A. Current Cognito Integration**
```typescript
// Get current provider from Cognito
const getCurrentProvider = async () => {
    const user = await getCurrentUser();
    return {
        providerId: user.sub,
        email: user.signInDetails?.loginId || user.username,
        name: user.attributes?.name || user.username
    };
};
```

#### **B. Data Filtering by Provider**
```typescript
// Filter encounters by current provider
const getProviderEncounters = async (providerId: string) => {
    const jobs = await listHealthScribeJobs();
    
    // Filter by provider using tags
    const providerJobs = [];
    for (const job of jobs.MedicalScribeJobSummaries || []) {
        const tags = await listTagsForResource({ 
            ResourceArn: getJobArn(job.MedicalScribeJobName!) 
        });
        const providerTag = tags.Tags?.find(tag => tag.Key === 'ProviderId');
        if (providerTag?.Value === providerId) {
            providerJobs.push(job);
        }
    }
    return providerJobs;
};
```

### **3. UI/UX Enhancements**

#### **A. Encounters List with Filtering**
```typescript
// Enhanced conversations page with filtering
interface EncountersListProps {
    encounters: Encounter[];
    onPatientFilter: (patientName: string) => void;
    onStatusFilter: (status: string) => void;
}

const EncountersList = ({ encounters, onPatientFilter, onStatusFilter }: EncountersListProps) => {
    return (
        <Table
            columnDefinitions={[
                {
                    id: 'patientName',
                    header: 'Patient Name',
                    cell: (e: Encounter) => e.patientName,
                    sortingField: 'patientName',
                },
                {
                    id: 'encounterDate',
                    header: 'Encounter Date',
                    cell: (e: Encounter) => dayjs(e.encounterDate).format('MMMM D YYYY, H:mm'),
                    sortingField: 'encounterDate',
                },
                {
                    id: 'duration',
                    header: 'Duration',
                    cell: (e: Encounter) => formatDuration(e.encounterDuration),
                    sortingField: 'encounterDuration',
                },
                {
                    id: 'status',
                    header: 'Status',
                    cell: (e: Encounter) => <StatusIndicator type={getStatusType(e.status)}>{e.status}</StatusIndicator>,
                    sortingField: 'status',
                }
            ]}
            items={encounters}
            filter={
                <PropertyFilter
                    filteringProperties={[
                        { key: 'patientName', operators: [':', '!:', '=', '!='] },
                        { key: 'status', operators: [':', '!:', '=', '!='] }
                    ]}
                    // ... filter configuration
                />
            }
        />
    );
};
```

#### **B. Encounter Detail Page with Left Sidebar**
```typescript
// Enhanced encounter page matching EncounterDetails.png
const EncounterDetail = () => {
    const [selectedPatient, setSelectedPatient] = useState<string>();
    const [patientEncounters, setPatientEncounters] = useState<Encounter[]>([]);
    
    return (
        <Grid gridDefinition={[
            { colspan: { default: 12, xs: 3, s: 3, m: 3, l: 3 } }, // Left sidebar
            { colspan: { default: 12, xs: 9, s: 9, m: 9, l: 9 } }  // Main content
        ]}>
            {/* Left Sidebar - Patient Encounters List */}
            <Container>
                <SpaceBetween size="s">
                    <Box variant="h3">Patient Encounters</Box>
                    {patientEncounters.map(encounter => (
                        <Box
                            key={encounter.encounterId}
                            padding="s"
                            className={encounter.encounterId === currentEncounterId ? 'selected' : ''}
                        >
                            <Link to={`/encounter/${encounter.healthScribeJobName}`}>
                                <Box variant="strong">{encounter.patientName}</Box>
                                <Box variant="small" color="text-body-secondary">
                                    {dayjs(encounter.encounterDate).format('MMM D, YYYY')}
                                </Box>
                                <Box variant="small" color="text-body-secondary">
                                    Duration: {formatDuration(encounter.encounterDuration)}
                                </Box>
                            </Link>
                        </Box>
                    ))}
                </SpaceBetween>
            </Container>
            
            {/* Main Content - Tabs */}
            <div>
                <Tabs
                    activeTabId={activeTab}
                    onChange={({ detail }) => setActiveTab(detail.activeTabId)}
                    tabs={[
                        {
                            id: 'transcript',
                            label: 'Transcript',
                            content: <TranscriptTab />
                        },
                        {
                            id: 'clinical-note',
                            label: 'Clinical Note', 
                            content: <ClinicalNoteTab />
                        },
                        {
                            id: 'insights',
                            label: 'Insights',
                            content: <InsightsTab />
                        }
                    ]}
                />
            </div>
        </Grid>
    );
};
```

---

## **🔧 IMPLEMENTATION PHASES**

### **Phase 1: Immediate Fixes (Tags-Based)**
1. **Add Provider/Patient Tags to HealthScribe Jobs**
2. **Filter Encounters by Current Provider**
3. **Fix Duration Column (Recording Duration vs Job Duration)**
4. **Add Patient Name Filtering**
5. **Add Status Filtering**

### **Phase 2: Enhanced Architecture (DynamoDB)**
1. **Create DynamoDB Tables for Providers/Patients/Encounters**
2. **Implement Proper Data Relationships**
3. **Add Patient Management UI**
4. **Enhanced Encounter Management**

### **Phase 3: Advanced Features**
1. **Patient Demographics**
2. **Encounter Templates**
3. **Provider Analytics**
4. **Audit Logging**

---

## **📊 DATA FLOW ARCHITECTURE**

### **Current Flow (Single Tenant):**
```
User Login → See All Encounters → Select Encounter → View Details
```

### **Proposed Flow (Multi-Tenant):**
```
Provider Login → See Only Their Encounters → Filter by Patient/Status → Select Encounter → View Details with Patient Context
```

### **Enhanced Recording Flow:**
```
Provider → Select/Create Patient → Start Recording → Submit Encounter → 
Auto-tag with Provider/Patient Info → Process with HealthScribe → 
Store Encounter Metadata → Display in Provider's Encounter List
```

---

## **🛡️ SECURITY & COMPLIANCE**

### **Data Isolation:**
- **Provider Level**: Each provider only sees their data
- **Patient Level**: Patient data tied to specific provider
- **Encounter Level**: Encounters linked to provider-patient relationship

### **HIPAA Compliance:**
- **Audit Logging**: Track all data access
- **Encryption**: All data encrypted at rest and in transit
- **Access Controls**: Role-based access to patient data
- **Data Retention**: Configurable retention policies

---

## **🧪 TESTING SCENARIOS**

### **Multi-Tenancy Testing:**
1. **Provider A** creates encounters for Patients 1, 2, 3
2. **Provider B** creates encounters for Patients 4, 5, 6
3. **Provider A** login should only see Patients 1, 2, 3 encounters
4. **Provider B** login should only see Patients 4, 5, 6 encounters

### **Filtering Testing:**
1. Filter by Patient Name: "John" should show only John's encounters
2. Filter by Status: "COMPLETED" should show only completed encounters
3. Combined filters should work together

### **Duration Testing:**
1. Record 30-second audio
2. Duration column should show "00:30" (recording time)
3. NOT the HealthScribe processing time (which might be 2+ minutes)

---

## **📋 IMPLEMENTATION CHECKLIST**

### **✅ Phase 1 - Immediate (Tags-Based)**
- [ ] Add provider/patient tags to HealthScribe job creation
- [ ] Implement provider-based encounter filtering
- [ ] Fix duration column to show recording duration
- [ ] Add patient name and status filtering to encounters list
- [ ] Create left sidebar with patient encounters list
- [ ] Update encounter detail page layout

### **✅ Phase 2 - Enhanced (DynamoDB)**
- [ ] Create DynamoDB tables for providers/patients/encounters
- [ ] Implement patient management CRUD operations
- [ ] Add encounter metadata management
- [ ] Create patient selection/creation UI
- [ ] Implement proper data relationships

### **✅ Phase 3 - Advanced**
- [ ] Patient demographics and medical history
- [ ] Encounter templates and workflows
- [ ] Provider analytics and reporting
- [ ] Advanced search and filtering
- [ ] Audit logging and compliance features

This architecture transforms the current single-tenant demo into a production-ready multi-tenant healthcare application with proper provider-patient-encounter relationships, data isolation, and comprehensive filtering capabilities.
