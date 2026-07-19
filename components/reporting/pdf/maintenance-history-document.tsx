import { Text, View } from '@react-pdf/renderer';
import type { MaintenanceHistoryDossier } from '@/lib/api/reports';
import {
  DossierDocumentShell,
  DossierKeyValue,
  DossierSection,
  dossierTableStyles,
  type DossierMeta,
} from './dossier-document';

function display(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function MaintenanceHistoryDocument({
  data,
  meta,
}: {
  data: MaintenanceHistoryDossier;
  meta: DossierMeta;
}) {
  const cse = data.case || {};
  const fault = data.fault || {};

  return (
    <DossierDocumentShell
      meta={{
        ...meta,
        headerTitle: 'Maintenance History Dossier',
        headerSubtitle: display(cse.maintenance_number),
      }}
    >
      <DossierSection title="Case Information">
        <DossierKeyValue label="Maintenance Number" value={display(cse.maintenance_number)} />
        <DossierKeyValue label="Current Status" value={display(cse.current_status)} />
        <DossierKeyValue label="Priority" value={display(cse.priority)} />
        <DossierKeyValue label="Opened Date" value={display(cse.opened_date)} />
        <DossierKeyValue label="Closed Date" value={display(cse.closed_date)} />
        <DossierKeyValue label="Engineer" value={display(cse.engineer)} />
        <DossierKeyValue label="Project" value={display(cse.project_name)} />
      </DossierSection>

      <DossierSection title="Fault Information">
        <DossierKeyValue label="Fault Description" value={display(fault.fault_description)} />
        <DossierKeyValue label="Fault Category" value={display(fault.fault_category)} />
        <DossierKeyValue label="Fault Type" value={display(fault.fault_type)} />
        <DossierKeyValue label="Root Cause" value={display(fault.root_cause)} />
        <DossierKeyValue label="Failure Mode" value={display(fault.failure_mode)} />
        <DossierKeyValue label="Severity" value={display(fault.severity)} />
      </DossierSection>

      <DossierSection title="Faulty Entities">
        {(data.faulty_entities || []).map((fe) => (
          <View key={fe.id} style={{ marginBottom: 8 }} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
              {display(fe.entity_name)} ({display(fe.entity_type)})
            </Text>
            <DossierKeyValue label="Part Number" value={display(fe.part_number)} />
            <DossierKeyValue label="Serial Number" value={display(fe.serial_number)} />
            <DossierKeyValue label="Status" value={display(fe.status)} />
            <DossierKeyValue label="Resolution" value={display(fe.resolution_type)} />
            <DossierKeyValue label="Fault" value={display(fe.fault_description)} />

            <Text style={{ marginTop: 4, marginBottom: 2, fontFamily: 'Helvetica-Bold' }}>
              Actions
            </Text>
            <View style={dossierTableStyles.table}>
              <View style={dossierTableStyles.headerRow}>
                <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Type</Text>
                <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Outcome</Text>
                <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Engineer</Text>
                <Text style={[dossierTableStyles.headerCell, { width: '20%' }]}>Date/Time</Text>
                <Text style={[dossierTableStyles.headerCell, { width: '12%' }]}>Duration</Text>
                <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Remarks</Text>
              </View>
              {(fe.actions || []).map((a) => (
                <View key={a.id} style={dossierTableStyles.row}>
                  <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                    {display(a.action_type)}
                  </Text>
                  <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                    {display(a.outcome)}
                  </Text>
                  <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                    {display(a.performed_by)}
                  </Text>
                  <Text style={[dossierTableStyles.cell, { width: '20%' }]}>
                    {display(a.performed_at)}
                  </Text>
                  <Text style={[dossierTableStyles.cell, { width: '12%' }]}>
                    {display(a.duration)}
                  </Text>
                  <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                    {display(a.notes)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </DossierSection>

      <DossierSection title="Replacement Information">
        <View style={dossierTableStyles.table}>
          <View style={dossierTableStyles.headerRow}>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Old PN</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Old SN</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>New PN</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>New SN</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Installed</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Reason</Text>
          </View>
          {(data.replacements || []).map((r) => (
            <View key={r.id} style={dossierTableStyles.row} wrap={false}>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(r.old_part_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(r.old_serial_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(r.new_part_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(r.new_serial_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(r.installation_date)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(r.reason)}
              </Text>
            </View>
          ))}
        </View>
      </DossierSection>

      <DossierSection title="Maintenance Timeline">
        {(data.timeline || []).map((ev, i) => (
          <View key={i} style={{ marginBottom: 4 }} wrap={false}>
            <Text>
              {display(ev.occurred_at)} — {ev.title}
              {ev.actor ? ` · ${ev.actor}` : ''}
            </Text>
            {ev.description ? <Text style={{ color: '#555' }}>{ev.description}</Text> : null}
          </View>
        ))}
      </DossierSection>

      <DossierSection title="Delivery Information">
        {(data.deliveries || []).map((del, i) => (
          <View key={i} style={{ marginBottom: 6 }} wrap={false}>
            <DossierKeyValue label="Type" value={display(del.delivery_type)} />
            <DossierKeyValue label="Status / Acceptance" value={display(del.acceptance || del.status)} />
            <DossierKeyValue label="Delivered By" value={display(del.delivered_by)} />
            <DossierKeyValue label="Received By" value={display(del.received_by)} />
            <DossierKeyValue label="Delivered At" value={display(del.delivered_at)} />
            <DossierKeyValue label="Returned Date" value={display(del.returned_date)} />
            <DossierKeyValue label="Remarks" value={display(del.notes)} />
          </View>
        ))}
      </DossierSection>

      <DossierSection title="Attachments">
        {(data.attachments || []).length === 0 ? (
          <Text>—</Text>
        ) : (
          (data.attachments || []).map((a) => (
            <Text key={a.id}>
              • {a.file_name} ({display(a.attachment_type)})
            </Text>
          ))
        )}
      </DossierSection>

      <DossierSection title="Signatures">
        <DossierKeyValue label="Prepared By" value={display(data.signatures?.prepared_by)} />
        <DossierKeyValue label="Reviewed By" value={display(data.signatures?.reviewed_by)} />
        <DossierKeyValue label="Approved By" value={display(data.signatures?.approved_by)} />
      </DossierSection>
    </DossierDocumentShell>
  );
}
