
# PROJECT: MEDLOG MSC Empty Container Return Appointment System (Côte d’Ivoire)

## ROLE

You are a senior full-stack software architect and logistics systems engineer.
You are tasked with designing and generating a production-ready application for MEDLOG Côte d’Ivoire.

The system manages **appointment scheduling for returning empty MSC containers to MEDLOG OFF-DOCK facilities in Côte d’Ivoire**.

---

## BUSINESS CONTEXT

MEDLOG CI operates OFF-DOCK terminals used exclusively for:

- Receiving empty MSC containers
- Managing container flow and yard capacity
- Coordinating transporters delivering containers

Transporters currently book appointments manually (calls, WhatsApp), causing:

- Congestion at OFF-DOCK gates
- Inefficient yard utilization
- Long truck waiting times
- Lack of centralized visibility for MSC & MEDLOG

---

## CORE OBJECTIVE

Build a centralized **Appointment & Flow Management System** that:

- Controls entry of MSC empty containers into MEDLOG OFF-DOCKs
- Automatically assigns OFF-DOCK and time slot
- Optimizes yard capacity and traffic flow
- Provides real-time tracking and analytics
- Eliminates manual booking processes

---

## MAIN RULE (VERY IMPORTANT)

⚠️ The OFF-DOCK selection is NOT chosen by the transporter.

The system (MEDLOG logic engine) must:

- Automatically assign the best OFF-DOCK
- Balance load across all sites
- Consider:
  - capacity
  - congestion
  - distance
  - time slot availability
  - operational constraints

---

## ACTORS

### 1. MEDLOG ADMIN

- Manage OFF-DOCKS
- Configure capacities
- Define rules and constraints
- View national dashboard
- Manage users and roles

### 2. OFF-DOCK OPERATOR

- Validate arrivals
- Scan QR codes
- Confirm container drop-off
- Manage yard operations
- Report incidents

### 3. TRANSPORT COMPANY

- Register trucks, trailers, drivers
- Submit appointment requests
- Track bookings
- Receive notifications

### 4. DRIVER (MOBILE USER)

- View assigned appointment
- Access QR code
- Receive navigation info
- Confirm arrival at gate

### 5. MSC (READ-ONLY DASHBOARD)

- Monitor container returns
- View KPIs
- Track OFF-DOCK performance

---

## BUSINESS ENTITIES

### Container Rules

- Only **MSC empty containers**
- Validate container prefix (MSC ownership rule)
- Reject invalid containers automatically

### Appointment Data

- Container number
- BL number (optional)
- Truck / trailer
- Driver identity
- Transport company
- Assigned OFF-DOCK (system generated)
- Time slot (system generated)
- Status lifecycle

---

## WORKFLOW

1. Transporter submits request:

   - container number
   - truck
   - driver
   - date preference
2. System validates:

   - MSC container format
   - eligibility for return
   - duplication check
3. System assigns:

   - OFF-DOCK (auto-selection engine)
   - time slot
   - QR code generation
4. Transporter receives confirmation
5. At gate:

   - QR scan validation
   - driver identification
   - entry authorization
6. OFF-DOCK operations:

   - container drop confirmation
   - status update to COMPLETED

---

## APPOINTMENT STATUS FLOW

- REQUESTED
- VALIDATED
- ASSIGNED
- CONFIRMED
- ARRIVED
- IN_PROGRESS
- COMPLETED
- REJECTED
- NO_SHOW
- CANCELLED

---

## CORE FEATURES

### 1. Smart Assignment Engine

- Load balancing across OFF-DOCKs
- Capacity-aware scheduling
- Dynamic congestion handling

### 2. QR Code System

- Unique per appointment
- Used at gate entry and exit

### 3. Real-time Dashboard

- OFF-DOCK occupancy
- Queue monitoring
- Live truck flow

### 4. Notification System

- SMS / WhatsApp / Email
- Appointment confirmation
- Delay alerts
- Reassignment alerts

### 5. Analytics

- Turnaround time per OFF-DOCK
- Daily throughput
- Transporter performance
- No-show rate

---

## NON-FUNCTIONAL REQUIREMENTS

- Response time < 2 seconds
- High availability (99.9%)
- Secure authentication (JWT/OAuth2)
- Audit logs for all operations
- Scalable to 10,000+ appointments/day

---

## TECHNICAL EXPECTATIONS

Generate:

### Backend

- REST API (Node.js / NestJS or equivalent)
- Database schema (PostgreSQL preferred)
- Business logic services:
  - assignment engine
  - scheduling engine
  - validation engine

### Frontend

- Admin dashboard
- Transporter portal
- OFF-DOCK operator interface

### Mobile (optional)

- Driver app (lightweight)

---

## IMPORTANT LOGIC RULES

- NEVER allow manual OFF-DOCK selection by transporter
- ALWAYS enforce capacity constraints
- NEVER accept non-MSC containers
- ALL appointments must have QR code
- SYSTEM is the single source of truth for scheduling

---

## OUTPUT EXPECTED FROM YOU (Claude Code)

1. Full system architecture
2. Database schema (tables + relations)
3. API endpoints list
4. Core backend services code
5. Frontend structure
6. Assignment algorithm logic
7. QR code generation flow
8. Deployment architecture

---

## FINAL NOTE

This is a **mission-critical logistics optimization system for MEDLOG Côte d’Ivoire**.

Prioritize:

- robustness
- scalability
- clarity
- operational realism in port logistics environments

