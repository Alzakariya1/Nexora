import React from 'react';
import EnterpriseFeatureWorkspace from './EnterpriseFeatureWorkspace.jsx';
import { FhirPreview, useIntegrationWorkspace, IntegrationKeyPanel, WebhookPanel } from './advancedUtils.jsx';

export default function FHIRAPIs({ currentHospital }) {
  const ws = useIntegrationWorkspace('Patient', 'fhir_enabled');
  return <>
    <EnterpriseFeatureWorkspace
      featureKey="fhir"
      title="FHIR APIs"
      eyebrow="FHIR API FOUNDATION"
      currentHospital={currentHospital}
      description="Manage FHIR resource readiness, API mappings, endpoint evidence and integration records for hospital interoperability."
      primaryRecord="resource_mapping"
      recordTypes={['resource_mapping','endpoint','api_key','webhook','test_case','evidence']}
      fields={[{key:'resource',label:'FHIR Resource',type:'select',options:['Patient','Encounter','Observation','DiagnosticReport','Invoice','MedicationRequest']},{key:'version',label:'FHIR Version',placeholder:'R4/R5'},{key:'auth_mode',label:'Auth Mode',type:'select',options:['Bearer token','API key','OAuth2 planned']}]}
      checklist={['Patient resource export','Encounter/appointment mapping','Observation and report mapping','Invoice export','API key and webhook audit trail']}
    />
    <div className="grid twoCols enterprise-feature-page"><IntegrationKeyPanel title="Create FHIR API Key" defaultName="FHIR R4 API Key" scopes={['fhir.read','fhir.write','webhook.write']} workspace={ws}/><WebhookPanel title="FHIR Webhook" defaultEvents="patient.created,appointment.created,billing.created" workspace={ws}/></div>
    <div className="enterprise-feature-page"><FhirPreview workspace={ws} title="Live FHIR Bundle Preview" /></div>
  </>;
}
