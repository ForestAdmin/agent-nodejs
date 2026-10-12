# Veterinary Service - Schema Manager Test

Test project demonstrating the `@forestadmin/plugin-schema-manager` plugin by creating a complete database schema for a veterinary service.

## Database Schema

### Tables

1. **clients** - Pet owners
   - id, first_name, last_name, email, phone, address, created_at, loyalty_points

2. **veterinarians** - Veterinary doctors
   - id, first_name, last_name, specialization, license_number, phone, email, hire_date

3. **pets** - Animals
   - id, name, species, breed, birth_date, weight_kg, microchip_id, client_id, is_active, registered_at

4. **appointments** - Scheduled visits
   - id, pet_id, vet_id, appointment_date, reason, notes, status, created_at

### Relationships

- `pets.client_id` → `clients.id` (CASCADE)
- `appointments.pet_id` → `pets.id` (CASCADE)
- `appointments.vet_id` → `veterinarians.id` (RESTRICT)

### Indexes

- `idx_clients_email` on `clients(email)` UNIQUE
- `idx_pets_client_id` on `pets(client_id)`
- `idx_appointments_pet_date` on `appointments(pet_id, appointment_date)`
- `idx_appointments_status` on `appointments(status)`

## Running the Test

```bash
# Install dependencies
yarn install

# Run the schema creation test
yarn ts-node test-schema.ts
```

## What Gets Created

The test will:
1. ✅ Create SQLite database file (`veterinary.db`)
2. ✅ Create 4 tables with proper columns and constraints
3. ✅ Create 4 indexes for performance
4. ✅ Create 3 foreign keys with cascade rules
5. ✅ Add a new column (`loyalty_points`) to existing table
6. ✅ Modify a column type (`weight_kg` from FLOAT to DECIMAL)

## Expected Output

```
🏥 Veterinary Service - Schema Creation Test
======================================================================
✅ Connected to SQLite database

1️⃣  Creating CLIENTS table...
   SQL: CREATE TABLE ...
✅ CLIENTS table created

2️⃣  Creating VETERINARIANS table...
✅ VETERINARIANS table created

3️⃣  Creating PETS table...
✅ PETS table created

4️⃣  Creating APPOINTMENTS table...
✅ APPOINTMENTS table created

5️⃣  Creating indexes...
   ✓ idx_clients_email
   ✓ idx_pets_client_id
   ✓ idx_appointments_pet_date
   ✓ idx_appointments_status
✅ Indexes created

6️⃣  Creating foreign keys...
   ✓ fk_pets_client (pets -> clients)
   ✓ fk_appointments_pet (appointments -> pets)
   ✓ fk_appointments_vet (appointments -> veterinarians)
✅ Foreign keys created

7️⃣  Verifying schema...
📊 Tables created: 4
   - clients
   - veterinarians
   - pets
   - appointments

8️⃣  Testing additional operations...
   Adding column "loyalty_points" to CLIENTS...
   ✅ Column added

   Modifying column "weight_kg" in PETS...
   ✅ Column modified

======================================================================
🎉 VETERINARY SERVICE SCHEMA CREATED SUCCESSFULLY!
======================================================================
```

## Files

- `index.ts` - Forest Admin agent configuration with plugin
- `test-schema.ts` - Direct schema creation test using executor
- `package.json` - Dependencies
- `veterinary.db` - SQLite database (created after running test)
