# NEXO PUNTOS — Firestore Security Specification

## 1. Data Invariants
1. **Master Admin Authority**: Only `blackstarproducciones.misiones@gmail.com` with `request.auth.token.email_verified == true` has platform-wide Master Admin privileges (`isMasterAdmin()`).
2. **Multi-Tenant Isolation (`comercioId`)**: Every operational document (`configuracion`, `membresias`, `clientes`, `cuentas_puntos`, `movimientos_puntos`, `premios`, `canjes`, `notificaciones`, `operaciones_idempotentes`) carries a `comercioId`. Employees/owners of Comercio A can never read or write documents belonging to Comercio B.
3. **Employee-Only Point Authorization**: Customers (`clientes` / unprivileged users) can NEVER write to `cuentas_puntos` or `movimientos_puntos`, nor mark a `canje` as `entregado`. Scanning a QR code only identifies the client; points accreditation/deduction requires a verified active membership (`owner` or `employee`) in `membresias/{comercioId}_{uid}`.
4. **Immutable Audit Ledger**: `movimientos_puntos` documents cannot be deleted. Only `revertido` may transition from `false` to `true` when an authorized merchant staff member logs an offsetting `reversion` movement.
5. **Idempotent Scan Protection**: `operaciones_idempotentes/{operacionId}` is create-only and immutable, guaranteeing a double scan with the same `operacionId` fails atomically inside Firestore transactions.
6. **PII & Spoofing Guards**: `allow list` rules explicitly evaluate `resource.data` fields (`comercioId`, `uid`, or `clienteUid`) so clients cannot scrape unfiltered collections. All document IDs pass `isValidId()`, all strings enforce `.size()` bounds, and all create/update payloads enforce `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Credit Attack**: Customer updates `/cuentas_puntos/{id}` setting `puntosDisponibles: 99999` without an active `membresia` in that `comercioId`.
2. **Spoofed Master Admin**: Attacker creates an account with `email: "blackstarproducciones.misiones@gmail.com"` where `email_verified: false` and tries to list `/comercios`.
3. **Cross-Tenant Read**: Employee of `comercio-a` runs `getDoc(/clientes/client-from-b)` where `resource.data.comercioId == 'comercio-b'`.
4. **Cross-Tenant Write**: Employee of `comercio-a` writes a `/movimientos_puntos` document with `comercioId: 'comercio-b'`.
5. **Fake Employee Escalation**: Regular user writes `/membresias/comercio-a_myUid` with `rol: 'owner'` when they are not the owner or Master Admin.
6. **QR Impersonation / Credit**: Customer creates `/movimientos_puntos/{id}` setting `autorizadoPorUid` to an employee's UID.
7. **Shadow Field Injection**: Merchant updates `/comercios/{id}` injecting `"plan": "multisucursal"` or `"estado": "activo"` (fields reserved exclusively for `isMasterAdmin()`).
8. **Ledger Deletion**: Suspended or rogue employee tries `deleteDoc(/movimientos_puntos/tx-1)` to erase audit history.
9. **Terminal Canje Tampering**: Customer updates `/canjes/{id}` from `estado: 'pendiente'` to `estado: 'entregado'`, or modifies an already `'entregado'` canje.
10. **Blanket Collection Scraping**: Non-admin user calls `getDocs(collection(db, 'clientes'))` without a `where('comercioId', '==', ...)` constraint.
11. **Oversized Payload / Resource Poisoning**: Malicious user creates a document with a 5KB `comercioId` or `nombre` string exceeding `.size()` limits.
12. **Double-Scan Replay**: Employee attempts `updateDoc(/operaciones_idempotentes/{opId})` to overwrite an existing idempotency record.
