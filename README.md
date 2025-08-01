# 🏥 NAINA HEALTHSCRIBE - MULTI-TENANT HEALTHCARE APPLICATION

**Project Name:** Naina HealthScribe  
**Description:** Enterprise-grade cloud-based AI Medical Scribe application for healthcare providers. Enables secure, multi-tenant practice management where providers conduct patient encounters to generate transcripts, clinical notes, and actionable insights.  
**Status:** In Development - DynamoDB-based Multi-Tenant Architecture  
**Infrastructure:** All resources deployed through Infrastructure as Code (IaC)

## **🎯 BUSINESS REQUIREMENTS**

### **Multi-Tenant Practice Management**
- **Practice Isolation**: Complete data segregation between practices
- **Role-Based Access**: Practice admins, providers, and staff with appropriate permissions
- **Admin Capabilities**:
  - Manage practice members (add/remove)
  - View and edit billing information
  - Access practice-wide analytics and reporting

### **Clinical Workflow Features**
- **Encounter Management**: Provider-patient encounter tracking with full audit trail
- **Clinical Note Editing**: Section-by-section editing and saving capabilities
- **Task Management**: AI-generated and manual task creation from clinical notes
- **Document Templates**: Customizable templates for various medical documents
- **Email Notifications**: Account creation and periodic update notifications

### **EHR Integration & Patient Context**
- **EHR Integration**: Seamless integration with external Electronic Health Record systems
- **Patient Context**: Patient information provided by EHR system during encounter creation
- **Encounter History**: Chronological encounter tracking per patient from EHR data
- **Left Sidebar Navigation**: Patient encounter list as shown in EncounterDetails.png

### **📋 Current Issues:**
1. **❌ No Multi-Tenancy**: All providers see all encounters - requires complete data isolation
2. **❌ No EHR Integration**: Missing integration with external Electronic Health Record systems
3. **❌ No Provider Isolation**: No data segregation by provider - critical security issue
4. **❌ No Filtering**: Can't filter encounters by patient name or status
5. **❌ Wrong Duration**: Shows HealthScribe job processing time, not actual encounter duration
6. **❌ Missing Encounter List**: No left sidebar with patient encounters navigation
7. **❌ No Task Management**: Missing AI-generated and manual task creation from clinical notes
8. **❌ No Document Templates**: No customizable templates for various medical documents

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

## **🏗️ SOLUTION ARCHITECTURE**

### **1. DynamoDB-Based Multi-Tenant Data Model**

#### **Core Tables Structure**
```typescript
// Table 1: Providers
interface Provider {
    providerId: string;        // PK: Cognito user sub
    email: string;
    name: string;
    specialty?: string;
    ehrSystemId?: string;      // EHR system identifier
    createdAt: string;
    updatedAt: string;
}

// Table 2: Encounters
interface Encounter {
    encounterId: string;       // PK: UUID
    providerId: string;        // GSI: Provider's encounters
    patientId: string;         // GSI: Patient's encounters (from EHR)
    patientName: string;       // From EHR system
    ehrEncounterId?: string;   // EHR system encounter ID
    healthScribeJobName: string; // Link to HealthScribe job
    encounterDate: string;
    encounterDuration: number; // Actual recording duration
    status: 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    audioFileUri?: string;
    transcriptUri?: string;
    clinicalNotesUri?: string;
    // EHR Integration fields
    ehrPatientData?: {         // Patient context from EHR
        patientId: string;
        patientName: string;
        dateOfBirth?: string;
        mrn?: string;          // Medical Record Number
        demographics?: any;
    };
    createdAt: string;
    updatedAt: string;
}

// Table 3: Tasks (Future Enhancement)
interface Task {
    taskId: string;            // PK: UUID
    encounterId: string;       // GSI: Encounter's tasks
    providerId: string;        // GSI: Provider's tasks
    title: string;
    category: string;
    description?: string;
    status: 'PENDING' | 'COMPLETED';
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

// Table 4: Templates (Future Enhancement)
interface Template {
    templateId: string;        // PK: UUID
    providerId: string;        // GSI: Provider's templates
    templateName: string;
    templateType: string;
    sections: TemplateSection[];
    formatting: TemplateFormatting;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
```

### **2. Authentication & Authorization**

#### **Cognito Integration**
```typescript
// Get current provider from Cognito
const getCurrentProvider = async (): Promise<Provider> => {
    const user = await getCurrentUser();
    
    // Auto-create provider record on first login
    let provider = await getProvider(user.sub);
    if (!provider) {
        provider = await createProvider({
            providerId: user.sub,
            email: user.signInDetails?.loginId || user.username,
            name: user.attributes?.name || user.username,
            specialty: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    return provider;
};
```

#### **Data Access Control**
```typescript
// All data operations scoped to current provider
const getProviderEncounters = async (providerId: string): Promise<Encounter[]> => {
    return await queryEncountersByProvider(providerId);
};

const getPatientEncounters = async (patientId: string, providerId: string): Promise<Encounter[]> => {
    // Get encounters for a specific patient, scoped to current provider
    return await queryEncountersByPatientAndProvider(patientId, providerId);
};
```

### **3. Enhanced Recording & Encounter Flow**

#### **EHR-Integrated Recording Process**
```typescript
const createEncounterWithEHRPatient = async (encounterData: {
    providerId: string;
    ehrPatientData: {
        patientId: string;
        patientName: string;
        dateOfBirth?: string;
        mrn?: string;
        demographics?: any;
    };
    ehrEncounterId?: string;
    audioFileUri: string;
    encounterDuration: number;
}) => {
    // Generate unique identifiers
    const encounterId = generateUUID();
    const healthScribeJobName = `${encounterData.providerId}-${encounterData.ehrPatientData.patientId}-${Date.now()}`;
    
    // Create encounter record with EHR patient data
    const encounter: Encounter = {
        encounterId,
        providerId: encounterData.providerId,
        patientId: encounterData.ehrPatientData.patientId,
        patientName: encounterData.ehrPatientData.patientName,
        ehrEncounterId: encounterData.ehrEncounterId,
        healthScribeJobName,
        encounterDate: new Date().toISOString(),
        encounterDuration: encounterData.encounterDuration,
        status: 'PROCESSING',
        audioFileUri: encounterData.audioFileUri,
        ehrPatientData: encounterData.ehrPatientData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Store encounter metadata
    await createEncounter(encounter);
    
    // Submit to HealthScribe
    await submitHealthScribeJob(healthScribeJobName, encounterData.audioFileUri);
    
    return encounterId;
};
```

### **4. Enhanced UI Architecture**

#### **Multi-Tenant Encounters List**
```typescript
const EncountersList = () => {
    const [encounters, setEncounters] = useState<Encounter[]>([]);
    const [filteredEncounters, setFilteredEncounters] = useState<Encounter[]>([]);
    const [currentProvider, setCurrentProvider] = useState<Provider>();
    
    useEffect(() => {
        const loadProviderData = async () => {
            const provider = await getCurrentProvider();
            setCurrentProvider(provider);
            
            // Load only provider's encounters
            const providerEncounters = await getProviderEncounters(provider.providerId);
            setEncounters(providerEncounters);
            setFilteredEncounters(providerEncounters);
        };
        
        loadProviderData();
    }, []);
    
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
                    cell: (e: Encounter) => (
                        <StatusIndicator type={getStatusType(e.status)}>
                            {e.status}
                        </StatusIndicator>
                    ),
                    sortingField: 'status',
                }
            ]}
            items={filteredEncounters}
            filter={
                <PropertyFilter
                    filteringProperties={[
                        { key: 'patientName', operators: [':', '!:', '=', '!='] },
                        { key: 'status', operators: [':', '!:', '=', '!='] },
                        { key: 'encounterDate', operators: ['>', '<', '=', '!='] }
                    ]}
                    onChange={({ detail }) => handleFilterChange(detail)}
                />
            }
            pagination={<Pagination currentPageIndex={1} pagesCount={10} />}
        />
    );
};
```

#### **Enhanced Encounter Detail Page**
```typescript
const EncounterDetail = () => {
    const { healthScribeJobName } = useParams();
    const [encounter, setEncounter] = useState<Encounter>();
    const [patientEncounters, setPatientEncounters] = useState<Encounter[]>([]);
    const [activeTab, setActiveTab] = useState('transcript');
    
    useEffect(() => {
        const loadEncounterData = async () => {
            // Load current encounter
            const currentEncounter = await getEncounterByJobName(healthScribeJobName);
            setEncounter(currentEncounter);
            
            // Load all encounters for this patient
            const allPatientEncounters = await getEncountersByPatient(currentEncounter.patientId);
            setPatientEncounters(allPatientEncounters);
        };
        
        loadEncounterData();
    }, [healthScribeJobName]);
    
    return (
        <Grid gridDefinition={[
            { colspan: { default: 12, xs: 3, s: 3, m: 3, l: 3 } }, // Left sidebar
            { colspan: { default: 12, xs: 9, s: 9, m: 9, l: 9 } }  // Main content
        ]}>
            {/* Left Sidebar - Patient Encounters List */}
            <Container>
                <SpaceBetween size="s">
                    <Box variant="h3">
                        {encounter?.patientName} - Encounters
                    </Box>
                    {patientEncounters.map(enc => (
                        <Box
                            key={enc.encounterId}
                            padding="s"
                            className={enc.encounterId === encounter?.encounterId ? 'selected' : ''}
                        >
                            <Link to={`/encounter/${enc.healthScribeJobName}`}>
                                <Box variant="strong">
                                    {dayjs(enc.encounterDate).format('MMM D, YYYY')}
                                </Box>
                                <Box variant="small" color="text-body-secondary">
                                    {dayjs(enc.encounterDate).format('h:mm A')}
                                </Box>
                                <Box variant="small" color="text-body-secondary">
                                    Duration: {formatDuration(enc.encounterDuration)}
                                </Box>
                                <StatusIndicator type={getStatusType(enc.status)}>
                                    {enc.status}
                                </StatusIndicator>
                            </Link>
                        </Box>
                    ))}
                </SpaceBetween>
            </Container>
            
            {/* Main Content - Enhanced Tabs */}
            <Container>
                <SpaceBetween size="m">
                    {/* Patient & Encounter Context */}
                    <Box>
                        <Box variant="h2">{encounter?.patientName}</Box>
                        <Box variant="small" color="text-body-secondary">
                            Encounter: {dayjs(encounter?.encounterDate).format('MMMM D, YYYY [at] h:mm A')} 
                            • Duration: {formatDuration(encounter?.encounterDuration || 0)}
                        </Box>
                    </Box>
                    
                    {/* Tabs */}
                    <Tabs
                        activeTabId={activeTab}
                        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
                        tabs={[
                            {
                                id: 'transcript',
                                label: 'Transcript',
                                content: <TranscriptTab encounter={encounter} />
                            },
                            {
                                id: 'clinical-note',
                                label: 'Clinical Note', 
                                content: <ClinicalNoteTab encounter={encounter} />
                            },
                            {
                                id: 'insights',
                                label: 'Insights',
                                content: <InsightsTab encounter={encounter} />
                            },
                            {
                                id: 'tasks',
                                label: 'Tasks',
                                content: <TasksTab encounter={encounter} />
                            }
                        ]}
                    />
                </SpaceBetween>
            </Container>
        </Grid>
    );
};
```

---

## **🔧 IMPLEMENTATION PHASES**

### **Phase 1: Core Multi-Tenancy Foundation (3-4 weeks)**
1. **DynamoDB Tables Infrastructure (IaC)**
   - Create Providers and Encounters tables
   - Configure proper GSIs and access patterns
   - Set up IAM roles and policies
   - Enable encryption and backup

2. **Data Access Layer Implementation**
   - Create TypeScript interfaces for all entities
   - Implement CRUD operations with proper validation
   - Add comprehensive error handling and logging
   - Create unit tests with >90% coverage

3. **Authentication Integration**
   - Auto-create provider records on first login
   - Implement provider context middleware
   - Add authorization checks for all operations
   - Create provider profile management

### **Phase 2: EHR Integration & Encounter Management (3-4 weeks)**
1. **EHR Integration Layer**
   - Create EHR patient data interfaces
   - Implement patient context handling from EHR
   - Add EHR encounter ID mapping
   - Create patient data validation

2. **Enhanced Encounter Creation Flow**
   - Integrate EHR patient selection into recording flow
   - Update HealthScribe job creation with EHR metadata
   - Implement proper status tracking
   - Store actual recording duration

3. **Multi-Tenant Encounters List**
   - Filter encounters by current provider
   - Add patient name and status filtering
   - Update table columns with proper formatting
   - Implement pagination and sorting

4. **Enhanced Encounter Detail Page**
   - Add left sidebar with patient encounter history
   - Improve main content layout and navigation
   - Add patient context and metadata display
   - Implement breadcrumb navigation

### **Phase 3: Advanced Features (6-8 weeks)**
1. **Task Management System**
   - Create Tasks DynamoDB table
   - Implement AI-powered task generation from clinical notes
   - Build task management UI with full CRUD operations
   - Add task status tracking and completion

2. **Custom Document Templates**
   - Create Templates DynamoDB table
   - Build template management system
   - Create template editor with drag-and-drop
   - Integrate templates with clinical note generation

3. **Practice Management & Multi-Tenancy**
   - Implement practice-level multi-tenancy
   - Create practice management UI
   - Add email notification system
   - Implement audit logging and compliance features

### **Phase 4: Testing & Deployment (2-3 weeks)**
1. **Comprehensive Testing**
   - Unit tests for all business logic
   - Integration tests for API endpoints
   - End-to-end tests for critical flows
   - Performance and security testing

2. **Production Deployment**
   - Environment-specific configurations
   - Monitoring and alerting setup
   - Backup and disaster recovery
   - Security compliance verification

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

### **✅ Phase 1 - Core Foundation (DynamoDB-Based)**
- [ ] Create DynamoDB tables for Providers and Encounters through IaC
- [ ] Implement data access layer with proper CRUD operations
- [ ] Integrate with Cognito authentication for provider management
- [ ] Add provider-based data isolation and authorization
- [ ] Create comprehensive unit tests for all business logic

### **✅ Phase 2 - EHR Integration & Encounter Management**
- [ ] Implement EHR patient data interfaces and validation
- [ ] Create EHR integration layer for patient context handling
- [ ] Update encounter creation to include EHR patient metadata
- [ ] Implement multi-tenant encounters list with proper filtering
- [ ] Fix duration column to show actual recording duration
- [ ] Create enhanced encounter detail page with left sidebar navigation
- [ ] Add patient context and encounter history display

### **✅ Phase 3 - Advanced Features**
- [ ] Implement task management system with AI-generated tasks
- [ ] Create custom document templates functionality
- [ ] Add practice-level multi-tenancy and admin capabilities
- [ ] Implement email notification system
- [ ] Add comprehensive audit logging and compliance features

### **✅ Phase 4 - Testing & Production**
- [ ] Complete comprehensive testing strategy (unit, integration, e2e)
- [ ] Set up monitoring, alerting, and backup systems
- [ ] Deploy through IaC pipeline with environment separation
- [ ] Verify security compliance and HIPAA requirements

**Note**: All infrastructure changes must be implemented through Infrastructure as Code (IaC) only. No manual AWS console changes are permitted.
