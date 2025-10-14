# /debug Command Documentation

The `/debug` command provides intelligent debugging assistance with root cause analysis, systematic troubleshooting, performance profiling, and automated fix generation for various programming languages and frameworks.

You will ALWAYS use first principles debugging to theorize on a root cause based on real code evidence
You will use ULTRATHINK when reasoning on your first principled root cause theory
You will ALWAYS challenge your theory and look for evidence which DISPROOVES
You will ALWAYS ask me to review yoru proposed fix and justification

AFTER I provide my specific approval, you will leverage the following subagents:
1. 'build-fixer' - and provide it SPECIFIC details on what you changed
2. 'commit-orchestrator' - provide it the same guidance

## Usage

```
/debug [options] <error_or_file>
```

## Options

### Debug Modes
- `--interactive` - Step-by-step guided debugging
- `--automated` - Automatic issue detection and fixes
- `--analysis` - Deep code analysis without fixes
- `--performance` - Performance bottleneck identification

### Error Types
- `--runtime` - Runtime errors and exceptions
- `--logic` - Logic errors and unexpected behavior
- `--memory` - Memory leaks and allocation issues
- `--network` - Network and API related problems
- `--database` - Database connection and query issues

### Scope Options
- `--function` - Debug specific function
- `--class` - Debug entire class
- `--module` - Debug module/file
- `--system` - System-wide debugging

### Output Formats
- `--format=detailed` - Comprehensive analysis (default)
- `--format=quick` - Quick diagnosis and fix
- `--format=checklist` - Debugging checklist
- `--format=trace` - Execution trace analysis

## Examples

### Runtime Error Debugging

```javascript
// Problematic code with multiple issues
const UserManager = {
  users: [],
  
  async addUser(userData) {
    // 🐛 Bug 1: No input validation
    const user = {
      id: this.users.length + 1, // 🐛 Bug 2: Race condition possible
      name: userData.name,
      email: userData.email,
      createdAt: new Date()
    };
    
    // 🐛 Bug 3: Async operation without proper error handling
    const result = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(user) // 🐛 Bug 4: Missing Content-Type header
    });
    
    // 🐛 Bug 5: No response status check
    const savedUser = await result.json();
    
    this.users.push(savedUser);
    return savedUser;
  },
  
  findUserByEmail(email) {
    // 🐛 Bug 6: Case-sensitive search
    return this.users.find(user => user.email === email);
  },
  
  deleteUser(userId) {
    // 🐛 Bug 7: Modifying array while iterating
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].id === userId) {
        this.users.splice(i, 1);
        break;
      }
    }
  }
};

// Error scenario
UserManager.addUser({ name: "John" }) // Missing email
  .then(user => console.log('Added:', user))
  .catch(error => console.error('Error:', error)); // 🐛 Error not properly caught
```

**Debug Analysis Output:**

---

# 🐛 Debug Analysis: UserManager

## 🚨 Critical Issues Found (7)

### Issue 1: Missing Input Validation
**Location:** Line 5 - `addUser` method  
**Severity:** High  
**Type:** Runtime Error

**Problem:**
```javascript
// Current code (vulnerable)
const user = {
  id: this.users.length + 1,
  name: userData.name,     // ❌ Could be undefined
  email: userData.email,   // ❌ Could be undefined
  createdAt: new Date()
};
```

**Error Symptoms:**
- `TypeError: Cannot read property 'name' of undefined`
- Silent failures with incomplete data
- Database constraint violations

**Root Cause:**  
No validation of input parameters allows undefined/null values to propagate through the system.

**Fix:**
```javascript
async addUser(userData) {
  // Input validation
  if (!userData || typeof userData !== 'object') {
    throw new Error('Invalid user data: expected object');
  }
  
  const required = ['name', 'email'];
  const missing = required.filter(field => !userData[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    throw new Error('Invalid email format');
  }
  
  // Continue with validated data...
}
```

### Issue 2: Race Condition in ID Generation
**Location:** Line 6  
**Severity:** High  
**Type:** Logic Error

**Problem:**
```javascript
id: this.users.length + 1, // ❌ Not thread-safe
```

**Race Condition Scenario:**
```
Thread A: reads length = 5, calculates id = 6
Thread B: reads length = 5, calculates id = 6
Thread A: adds user with id = 6
Thread B: adds user with id = 6 (DUPLICATE!)
```

**Fix Options:**

**Option 1: UUID (Recommended)**
```javascript
const { v4: uuidv4 } = require('uuid');

const user = {
  id: uuidv4(), // ✅ Guaranteed unique
  name: userData.name,
  email: userData.email,
  createdAt: new Date()
};
```

**Option 2: Atomic Counter**
```javascript
class UserManager {
  constructor() {
    this.users = [];
    this.nextId = 1;
  }
  
  generateId() {
    return this.nextId++; // ✅ Atomic increment
  }
}
```

