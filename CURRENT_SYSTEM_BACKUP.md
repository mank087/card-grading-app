# 📋 CURRENT SYSTEM DOCUMENTATION - PRE-STREAMLINE BACKUP

**Date:** 2025-09-20
**Purpose:** Document existing system before implementing streamlined evaluation process

## **Current Architecture Overview**

### **File Structure**
- **Main API Handler:** `/src/app/api/card/[id]/route.ts`
- **Card Processor:** `/src/lib/cardProcessor.ts`
- **Pokemon API:** `/src/lib/pokemonTcgApi.ts`
- **Frontend:** `/src/app/card/[id]/page.tsx`

### **Current Evaluation Flow**

#### **1. Request Processing (`route.ts` lines 686-1055)**
```typescript
GET /api/card/[id] → Check Processing State → Multi-Evaluation Logic → AI Grading → Database Updates → Response
```

#### **2. Multi-Evaluation System**
- **Target:** 3 evaluations per card
- **Current State:** Tracks progress in `ai_grading.evaluation_progress`
- **Database Updates:** After each evaluation (incremental saves)
- **Consensus:** Calculated after all evaluations complete

#### **3. Key Functions**
1. **`getCardEvaluationStatus()`** - Check evaluation completion status
2. **`getNextEvaluationNumber()`** - Determine which evaluation to run next
3. **`saveEvaluation()`** - Save individual evaluation to database
4. **`calculateConsensusScore()`** - Average multiple evaluations
5. **`updateCardConsensusScore()`** - Final consensus calculation
6. **`gradeCardWithAI()`** - Execute OpenAI Assistant API call

#### **4. Database Schema (Current)**
```sql
-- Main card table
cards: {
  ai_grading: JSON {
    multi_evaluations: [
      {
        evaluation_number: number,
        raw_grade: number,
        whole_grade: number,
        confidence: string,
        grading_result: object,
        processed_card_data: object,
        completed_at: timestamp
      }
    ],
    evaluation_progress: {
      completed: number,
      target: number,
      status: string
    }
  },
  evaluation_status: string,
  completed_evaluations: number,
  target_evaluations: number,
  consensus_raw_grade: number,
  consensus_whole_grade: number,
  [category-specific fields...]
}
```

#### **5. Processing State Management**
- **In-Memory Set:** `processingCards` - Prevents duplicate processing
- **Database Locking:** Checks `evaluation_status` and processing state
- **Race Condition Prevention:** Wait logic for concurrent requests

### **Current Issues Identified**

#### **🚨 Problems:**
1. **Multiple DB Writes:** 3-4 database updates per card evaluation
2. **Complex State Management:** Tracking evaluation progress across requests
3. **Race Conditions:** Multiple frontend requests causing duplicate processing
4. **Partial Data Display:** UI shows incomplete states during processing
5. **Error Recovery:** Complex rollback scenarios for failed evaluations
6. **Supabase Overhead:** Frequent database connections and transactions

#### **🔄 Current Request Flow:**
```
Frontend Request →
Check if processing →
Get next evaluation number →
Run AI grading →
Save evaluation →
Update progress →
Pokemon API processing →
Update database fields →
Response with current state →
Frontend polls again...
```

### **Current Components**

#### **A. CardProcessor (`cardProcessor.ts`)**
- **Purpose:** Integrate AI results with Pokemon TCG API
- **Input:** AI grading result + category
- **Output:** Combined data with Pokemon details
- **Features:**
  - Pokemon API lookup by card name/set/number
  - Database field mapping
  - Multiple AI response format handling

#### **B. Pokemon TCG API (`pokemonTcgApi.ts`)**
- **Features:** Card search, caching, database field mapping
- **API Key:** a69e2947-6080-4a50-84ae-9f91e054f33e
- **Caching:** 15-minute in-memory cache
- **Search Logic:** Name + Set + Number matching

#### **C. AI Response Formats**
Currently handles multiple formats:
- **New Pokemon Format:** `Card Identification`, `Final DCM Grade`
- **Old Magic Format:** `Card Identification Validation`, `Final Score`
- **Legacy Format:** Various field mappings for backward compatibility

### **Environment & Configuration**
- **Server:** Next.js 15.5.3 with Turbopack
- **Database:** Supabase (PostgreSQL)
- **AI:** OpenAI Assistant API
- **Port:** localhost:3006 (due to port 3000 conflict)
- **Storage:** Supabase Storage for card images

### **Current Performance Characteristics**
- **Evaluation Time:** 30-70 seconds per evaluation (AI processing)
- **Total Time:** 2-4 minutes for complete 3-evaluation cycle
- **Database Calls:** 8-12 per complete evaluation cycle
- **Memory Usage:** In-memory processing sets and caches

### **Frontend Behavior**
- **Polling:** Frontend makes repeated requests to check progress
- **State Display:** Shows "Evaluation X of 3" progress
- **Data Priority:** Database fields override AI fields in display
- **Error Handling:** Displays errors if evaluations fail

### **Integration Points**
1. **Pokemon TCG API** - External service for card details
2. **OpenAI Assistant** - AI grading service
3. **Supabase** - Database and file storage
4. **Next.js API Routes** - Backend processing
5. **React Frontend** - User interface

---

## **Backup Files Created**
- Current route.ts backed up as `route.ts.backup`
- Current cardProcessor.ts backed up as `cardProcessor.ts.backup`
- Current page.tsx backed up as `page.tsx.backup`

**Note:** This documentation captures the state before implementing the streamlined single-transaction approach.