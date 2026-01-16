# Frontend Data Structure Update

## ⚠️ IMPORTANT: Admin Data Structure Changed

The backend now returns a **different structure** for admin users after the latest update.

## Data Structure Changes

### Admin View (NEW Structure)

**Before (OLD):**
```typescript
{
  "2026": {
    "Jan": {
      clients: [...all clients mixed...],
      total: 10
    }
  }
}
```

**After (NEW):**
```typescript
{
  "3": {  // counsellorId
    counsellor: {
      id: 3,
      name: "Gaurav Parmar",
      designation: "..."
    },
    clients: {
      "2026": {
        "Jan": {
          clients: [...this counsellor's clients only...],
          total: 4
        }
      }
    }
  },
  "5": {  // another counsellorId
    counsellor: {
      id: 5,
      name: "Another Counsellor",
      designation: "..."
    },
    clients: {
      "2026": {
        "Jan": {
          clients: [...this counsellor's clients...],
          total: 6
        }
      }
    }
  }
}
```

### Counsellor View (UNCHANGED)

**Structure remains the same:**
```typescript
{
  "2026": {
    "Jan": {
      clients: [...this counsellor's clients...],
      total: 4
    }
  }
}
```

## Frontend Changes Required

### 1. Update Admin Component Rendering

**OLD Admin Component (needs update):**
```typescript
// ❌ OLD - This won't work anymore
const AdminClientsView = ({ data }) => {
  return Object.entries(data).map(([year, months]) => (
    <YearSection key={year} year={year}>
      {Object.entries(months).map(([month, { clients, total }]) => (
        <MonthSection key={month} month={month} total={total}>
          {clients.map(client => <ClientRow key={client.clientId} client={client} />)}
        </MonthSection>
      ))}
    </YearSection>
  ));
};
```

**NEW Admin Component (correct):**
```typescript
// ✅ NEW - Handle counsellor grouping first
const AdminClientsView = ({ data }) => {
  return Object.entries(data).map(([counsellorId, { counsellor, clients }]) => (
    <CounsellorGroup
      key={counsellorId}
      counsellor={counsellor}
      clientCount={Object.values(clients).reduce((sum, year) =>
        sum + Object.values(year).reduce((s, month) => s + month.total, 0), 0
      )}
    >
      {Object.entries(clients).map(([year, months]) => (
        <YearSection key={year} year={year}>
          {Object.entries(months).map(([month, { clients: monthClients, total }]) => (
            <MonthSection key={month} month={month} total={total}>
              {monthClients.map(client => (
                <ClientRow key={client.clientId} client={client} />
              ))}
            </MonthSection>
          ))}
        </YearSection>
      ))}
    </CounsellorGroup>
  ));
};
```

### 2. Update WebSocket Event Handlers

**The event data structure is the same, but make sure you're handling it correctly:**

```typescript
const handleClientCreated = (data: any) => {
  if (isAdmin) {
    // data.clients now has the NEW structure: { [counsellorId]: { counsellor, clients } }
    queryClient.setQueryData(['clients'], data.clients);
  } else {
    // Counsellor structure unchanged: { [year]: { [month]: {...} } }
    queryClient.setQueryData(['counsellor-clients'], data.clients);
  }
};
```

### 3. Update TypeScript Types

**Add type definitions:**

```typescript
// Admin structure
type AdminClientsData = {
  [counsellorId: string]: {
    counsellor: {
      id: number;
      name: string;
      designation: string | null;
    };
    clients: {
      [year: string]: {
        [month: string]: {
          clients: Client[];
          total: number;
        };
      };
    };
  };
};

// Counsellor structure (unchanged)
type CounsellorClientsData = {
  [year: string]: {
    [month: string]: {
      clients: Client[];
      total: number;
    };
  };
};
```

### 4. Update API Response Handling

**Make sure your fetch function handles both structures:**

```typescript
const fetchClients = async () => {
  const response = await fetch('/api/clients/counsellor-clients', {
    credentials: 'include',
  });
  const result = await response.json();

  if (result.success) {
    if (userRole === 'admin') {
      // Admin: result.data is AdminClientsData
      return result.data;
    } else {
      // Counsellor: result.data is CounsellorClientsData
      return result.data;
    }
  }
};
```

## Summary of Changes

### What Changed:
1. ✅ Admin data now grouped by counsellor first
2. ✅ Each counsellor has their own `clients` object with year/month grouping
3. ✅ Counsellor info included in each group

### What Stayed the Same:
1. ✅ Counsellor view structure unchanged
2. ✅ WebSocket event structure unchanged
3. ✅ Client object structure unchanged

### Frontend Must Update:
1. ⚠️ Admin component must iterate over counsellors first
2. ⚠️ Display counsellor name and client count
3. ⚠️ Then iterate over years/months within each counsellor
4. ⚠️ TypeScript types need updating

## Example: Complete Admin Component

```typescript
const AdminClientsPage = () => {
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchAllClients,
  });

  if (!clientsData) return <Loading />;

  return (
    <div>
      {Object.entries(clientsData).map(([counsellorId, { counsellor, clients }]) => {
        // Calculate total clients for this counsellor
        const totalClients = Object.values(clients).reduce(
          (sum, year) => sum + Object.values(year).reduce(
            (s, month) => s + month.total, 0
          ), 0
        );

        return (
          <div key={counsellorId} className="counsellor-group">
            <h3>
              {counsellor.name} ({totalClients} Clients)
            </h3>

            {Object.entries(clients).map(([year, months]) => (
              <div key={year} className="year-section">
                <h4>{year}</h4>
                {Object.entries(months).map(([month, { clients: monthClients, total }]) => (
                  <div key={month} className="month-section">
                    <h5>{month} ({total})</h5>
                    {monthClients.map(client => (
                      <ClientRow key={client.clientId} client={client} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
```
