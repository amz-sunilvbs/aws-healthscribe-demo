# 🚀 NAINA HEALTHSCRIBE - IMPLEMENTATION TASK LIST

## **PRIORITY 1: CORE MULTI-TENANCY FOUNDATION**

### **Task 1.1: DynamoDB Tables Infrastructure (IaC)**
**Priority**: Critical
**Estimated Effort**: 3-5 days
**Dependencies**: None

#### **Acceptance Criteria:**
- [ ] Create CDK/CloudFormation templates for 2 DynamoDB tables:
  - **Providers Table**: 
    - PK: `providerId` (string)
    - Attributes: `email`, `name`, `specialty`, `ehrSystemId`, `createdAt`, `updatedAt`
    - GSI: `email-index` for email-based lookups
  - **Encounters Table**:
    - PK: `encounterId` (string)
    - GSI1: `providerId-index` for provider's encounters
    - GSI2: `patientId-index` for patient's encounters (from EHR)
    - GSI3: `healthScribeJobName-index` for job lookups
    - Attributes: `providerId`, `patientId`, `patientName`, `ehrEncounterId`, `ehrPatientData`, `healthScribeJobName`, `encounterDate`, `encounterDuration`, `status`, `audioFileUri`, `transcriptUri`, `clinicalNotesUri`, `createdAt`, `updatedAt`
- [ ] Configure appropriate read/write capacity (on-demand recommended)
- [ ] Set up proper IAM roles and policies for Lambda access
- [ ] Enable point-in-time recovery for all tables
- [ ] Add encryption at rest using AWS managed keys
- [ ] Deploy through IaC pipeline with proper environment separation

#### **Definition of Done:**
- All tables created and accessible via AWS Console
- IAM policies tested and working
- Tables can be queried successfully from Lambda functions
- Infrastructure deployed in dev/staging/prod environments

---

### **Task 1.2: Data Access Layer (DAL) Implementation**
**Priority**: Critical  
**Estimated Effort**: 4-6 days
**Dependencies**: Task 1.1

#### **Acceptance Criteria:**
- [ ] Create TypeScript interfaces for all entities:
  ```typescript
  interface Provider {
    providerId: string;
    email: string;
    name: string;
    specialty?: string;
    ehrSystemId?: string;
    createdAt: string;
    updatedAt: string;
  }
  
  interface Encounter {
    encounterId: string;
    providerId: string;
    patientId: string;
    patientName: string;
    ehrEncounterId?: string;
    ehrPatientData?: {
      patientId: string;
      patientName: string;
      dateOfBirth?: string;
      mrn?: string;
      demographics?: any;
    };
    healthScribeJobName: string;
    encounterDate: string;
    encounterDuration: number;
    status: 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    audioFileUri?: string;
    transcriptUri?: string;
    clinicalNotesUri?: string;
    createdAt: string;
    updatedAt: string;
  }
  ```
- [ ] Implement CRUD operations for each entity:
  - **Providers**: `createProvider`, `getProvider`, `updateProvider`, `listProviders`
  - **Encounters**: `createEncounter`, `getEncounter`, `updateEncounter`, `deleteEncounter`, `listEncountersByProvider`, `listEncountersByPatient`
- [ ] Implement proper error handling and validation
- [ ] Add comprehensive logging for all operations
- [ ] Create unit tests with >90% coverage
- [ ] Implement connection pooling and retry logic

#### **Definition of Done:**
- All CRUD operations working and tested
- Unit tests passing
- Error handling covers all edge cases
- Performance benchmarks meet requirements (<100ms for single item operations)

---

### **Task 1.3: Authentication Integration & Provider Management**
**Priority**: Critical
**Estimated Effort**: 2-3 days  
**Dependencies**: Task 1.2

#### **Acceptance Criteria:**
- [ ] Integrate with existing Cognito authentication
- [ ] Create provider record automatically on first login:
  ```typescript
  const handleFirstLogin = async (cognitoUser: CognitoUser) => {
    const existingProvider = await getProvider(cognitoUser.sub);
    if (!existingProvider) {
      await createProvider({
        providerId: cognitoUser.sub,
        email: cognitoUser.email,
        name: cognitoUser.name || cognitoUser.email,
        specialty: '', // To be filled later
        ehrSystemId: '', // To be configured
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };
  ```
- [ ] Implement middleware to extract current provider context
- [ ] Add provider profile management UI
- [ ] Ensure all API calls are scoped to current provider
- [ ] Add proper authorization checks for all operations

#### **Definition of Done:**
- Provider records created automatically on login
- All API endpoints properly secured
- Provider profile can be viewed and updated
- Authorization working correctly

---

## **PRIORITY 2: EHR INTEGRATION & ENCOUNTER MANAGEMENT**

### **Task 2.1: EHR Integration Layer**
**Priority**: High
**Estimated Effort**: 4-5 days
**Dependencies**: Task 1.3

#### **Acceptance Criteria:**
- [ ] Create EHR patient data interfaces and validation:
  ```typescript
  interface EHRPatientData {
    patientId: string;
    patientName: string;
    dateOfBirth?: string;
    mrn?: string;
    demographics?: {
      gender?: string;
      address?: string;
      phone?: string;
      email?: string;
    };
  }
  
  interface EHREncounterContext {
    ehrEncounterId?: string;
    encounterType?: string;
    department?: string;
    referringPhysician?: string;
  }
  ```
- [ ] Implement patient context handling from EHR system
- [ ] Add EHR encounter ID mapping and validation
- [ ] Create patient data validation and sanitization
- [ ] Implement EHR system configuration per provider
- [ ] Add error handling for EHR integration failures
- [ ] Create mock EHR service for development and testing

#### **Definition of Done:**
- EHR patient data interfaces implemented and tested
- Patient context properly handled from external EHR
- EHR encounter mapping working correctly
- Mock EHR service available for development

---

### **Task 2.2: Enhanced Encounter Creation Flow**
**Priority**: High
**Estimated Effort**: 5-7 days
**Dependencies**: Task 2.1

#### **Acceptance Criteria:**
- [ ] Modify recording flow to include EHR patient selection:
  - Integration with EHR patient lookup/search
  - Patient context display during encounter creation
  - EHR patient data validation before recording starts
- [ ] Update HealthScribe job creation to store encounter metadata:
  ```typescript
  const createEncounterWithEHRPatient = async (encounterData: {
    providerId: string;
    ehrPatientData: EHRPatientData;
    ehrEncounterId?: string;
    audioFileUri: string;
    encounterDuration: number;
  }) => {
    const encounterId = generateUUID();
    const healthScribeJobName = `${providerId}-${ehrPatientData.patientId}-${Date.now()}`;
    
    // Create encounter record with EHR patient data
    await createEncounterRecord({
      encounterId,
      ...encounterData,
      patientName: ehrPatientData.patientName,
      healthScribeJobName,
      status: 'PROCESSING',
      encounterDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Submit to HealthScribe
    await submitHealthScribeJob(healthScribeJobName, audioFileUri);
    
    return encounterId;
  };
  ```
- [ ] Implement encounter status tracking and updates
- [ ] Add proper error handling for failed HealthScribe jobs
- [ ] Store actual recording duration (not processing time)

#### **Definition of Done:**
- EHR patient selection integrated into recording flow
- Encounter metadata properly stored with EHR context
- Status tracking working correctly
- Recording duration accurately captured

---

### **Task 2.3: Multi-Tenant Encounters List**
**Priority**: High
**Estimated Effort**: 3-4 days
**Dependencies**: Task 2.2

#### **Acceptance Criteria:**
- [ ] Update conversations page to show only provider's encounters
- [ ] Implement proper filtering and search:
  - Filter by patient name (from EHR data)
  - Filter by encounter status
  - Filter by date range
  - Combined filters working together
- [ ] Update table columns:
  - Patient Name (from EHR, sortable)
  - Encounter Date (sortable, formatted properly)
  - Duration (actual recording duration, formatted as MM:SS)
  - Status (with proper status indicators)
  - Actions (View, Delete)
- [ ] Add pagination for large encounter lists
- [ ] Implement proper loading states
- [ ] Add empty state when no encounters exist

#### **Definition of Done:**
- Only provider's encounters visible
- All filtering options working with EHR patient data
- Table properly formatted and sortable
- Performance acceptable with large datasets

---

### **Task 2.4: Enhanced Encounter Detail Page**
**Priority**: Medium
**Estimated Effort**: 4-5 days
**Dependencies**: Task 2.3

#### **Acceptance Criteria:**
- [ ] Implement left sidebar with patient's encounter history:
  - List all encounters for the current patient (from EHR)
  - Highlight current encounter
  - Show encounter date and duration
  - Click to navigate between encounters
- [ ] Update main content area layout:
  - Maintain existing tabs (Transcript, Clinical Note, Insights)
  - Add patient context header with EHR data
  - Improve responsive design
- [ ] Add encounter metadata display:
  - Patient name and EHR details
  - Encounter date and time
  - Recording duration
  - Processing status
  - EHR encounter ID (if available)
- [ ] Implement proper navigation between encounters
- [ ] Add breadcrumb navigation

#### **Definition of Done:**
- Left sidebar showing patient encounters from EHR context
- Navigation between encounters working
- Patient context from EHR clearly displayed
- Responsive design maintained

---

## **PRIORITY 3: ADVANCED FEATURES**

### **Task 3.1: Task Management System**
**Priority**: Medium
**Estimated Effort**: 6-8 days
**Dependencies**: Task 2.4

#### **Acceptance Criteria:**
- [ ] Create Tasks DynamoDB table through IaC:
  - PK: `taskId` (string)
  - GSI: `encounterId-index` for encounter tasks
  - Attributes: `encounterId`, `providerId`, `title`, `category`, `description`, `status`, `createdAt`, `updatedAt`, `completedAt`
- [ ] Implement task generation from clinical notes:
  - Parse clinical notes for action items
  - Auto-generate tasks with AI/NLP
  - Manual task creation capability
- [ ] Create task management UI:
  - Collapsible task panel on encounter detail page
  - Task list with checkboxes
  - Edit task functionality
  - Delete task capability
  - Add new task manually
- [ ] Implement task status management:
  - Mark as done/undone
  - Task completion timestamps
  - Task history tracking

#### **Definition of Done:**
- Task table created and accessible
- Task generation working from clinical notes
- Task management UI fully functional
- Task status tracking implemented

---

### **Task 3.2: Custom Document Templates**
**Priority**: Medium
**Estimated Effort**: 8-10 days
**Dependencies**: Task 3.1

#### **Acceptance Criteria:**
- [ ] Create Templates DynamoDB table through IaC:
  - PK: `templateId` (string)
  - GSI: `providerId-index` for provider templates
  - Attributes: `providerId`, `templateName`, `templateType`, `sections`, `formatting`, `isActive`, `createdAt`, `updatedAt`
- [ ] Implement template management system:
  - Create/edit/delete templates
  - Template categories (discharge summary, referral letter, etc.)
  - Section-based template structure
  - Template preview functionality
- [ ] Integrate templates with clinical note generation:
  - Apply template to encounter notes
  - Template-based note formatting
  - Custom field mapping
- [ ] Create template management UI:
  - Template library page
  - Template editor with drag-and-drop sections
  - Template preview and testing

#### **Definition of Done:**
- Template system fully implemented
- Template editor working
- Templates can be applied to encounters
- Template library accessible to providers

---

### **Task 3.3: Practice Management & Multi-Tenancy**
**Priority**: Low
**Estimated Effort**: 10-12 days
**Dependencies**: Task 3.2

#### **Acceptance Criteria:**
- [ ] Create Practice and PracticeMembers tables through IaC
- [ ] Implement practice-level multi-tenancy:
  - Practice admins can manage members
  - Practice-level data isolation
  - Member role management (admin, provider, staff)
- [ ] Create practice management UI:
  - Practice dashboard
  - Member management
  - Billing information management
  - Practice settings
- [ ] Implement email notification system:
  - Account creation emails
  - Periodic update emails
  - Practice invitation emails
- [ ] Add audit logging and compliance features

#### **Definition of Done:**
- Practice-level multi-tenancy working
- Practice management UI complete
- Email notifications functional
- Audit logging implemented

---

## **INFRASTRUCTURE & DEPLOYMENT**

### **Task 4.1: IaC Pipeline Enhancement**
**Priority**: High (Parallel with other tasks)
**Estimated Effort**: 3-4 days

#### **Acceptance Criteria:**
- [ ] Update CDK/CloudFormation templates for all new resources
- [ ] Implement proper environment separation (dev/staging/prod)
- [ ] Add database migration scripts
- [ ] Configure monitoring and alerting
- [ ] Set up backup and disaster recovery
- [ ] Implement security scanning and compliance checks

#### **Definition of Done:**
- All infrastructure deployable through IaC
- Environment separation working
- Monitoring and alerting configured
- Security compliance verified

---

## **TESTING & QUALITY ASSURANCE**

### **Task 5.1: Comprehensive Testing Strategy**
**Priority**: High (Parallel with development)
**Estimated Effort**: Ongoing

#### **Acceptance Criteria:**
- [ ] Unit tests for all business logic (>90% coverage)
- [ ] Integration tests for API endpoints
- [ ] End-to-end tests for critical user flows
- [ ] Performance testing for database operations
- [ ] Security testing for authentication/authorization
- [ ] Multi-tenant isolation testing
- [ ] EHR integration testing with mock services

#### **Definition of Done:**
- All tests passing
- Coverage targets met
- Performance benchmarks achieved
- Security vulnerabilities addressed
- EHR integration properly tested

---

## **TIMELINE ESTIMATE**

**Total Estimated Effort**: 35-50 days (reduced from 45-65 days)
**Recommended Team Size**: 2-3 developers
**Estimated Calendar Time**: 2.5-3.5 months

### **Phase Breakdown:**
- **Phase 1 (Foundation)**: 2-3 weeks
- **Phase 2 (EHR Integration & Encounters)**: 3-4 weeks  
- **Phase 3 (Advanced Features)**: 6-8 weeks
- **Testing & Polish**: 2-3 weeks

### **Critical Path:**
Task 1.1 → Task 1.2 → Task 1.3 → Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4

### **Parallel Development Opportunities:**
- Infrastructure tasks can run parallel with development
- UI tasks can start once API contracts are defined
- Testing can be implemented alongside feature development
- EHR integration layer can be developed with mock services initially
