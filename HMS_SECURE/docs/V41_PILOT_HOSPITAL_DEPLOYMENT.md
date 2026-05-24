# V41: Pilot Hospital Deployment

Goal: prepare the HMS for a real first hospital/clinic pilot after SaaS, sales, legal and QA readiness.

## Added
- Pilot Deployment Center UI
- Pilot deployment backend APIs
- Pilot tasks and readiness scoring
- Training/migration/go-live checklist foundation
- Hospital pilot owner, target date, stage and success criteria tracking

## Recommended pilot flow
1. Create hospital tenant and admin user.
2. Create pilot deployment record.
3. Confirm scope modules: patients, appointments, billing, pharmacy, lab, inventory as required.
4. Add tasks for configuration, data migration, staff training and go-live support.
5. Track readiness percentage before go-live.
6. Move stage from planning -> active -> live.

## Release gate
Do not start a paid rollout until:
- tenant isolation is verified
- backup/restore is tested
- staff training is completed
- billing flow is verified
- support contact and escalation process are agreed
