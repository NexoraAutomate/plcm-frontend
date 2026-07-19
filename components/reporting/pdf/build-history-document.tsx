import { Text, View } from '@react-pdf/renderer';
import type { BuildHistoryDossier, HierarchyEntityNode } from '@/lib/api/reports';
import {
  DossierDocumentShell,
  DossierKeyValue,
  DossierSection,
  dossierTableStyles,
  type DossierMeta,
} from './dossier-document';

function flattenHierarchy(
  nodes: HierarchyEntityNode[],
  depth = 0
): (HierarchyEntityNode & { depth: number })[] {
  const out: (HierarchyEntityNode & { depth: number })[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    out.push(...flattenHierarchy(n.children || [], depth + 1));
  }
  return out;
}

function display(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function BuildHistoryDocument({
  data,
  meta,
}: {
  data: BuildHistoryDossier;
  meta: DossierMeta;
}) {
  const flat = flattenHierarchy(data.hierarchy || []);
  const p = data.project || {};
  const c = data.customer || {};
  const o = data.order || {};
  const d = data.delivery || {};

  return (
    <DossierDocumentShell
      meta={{
        ...meta,
        headerTitle: 'Build History Dossier',
        headerSubtitle: display(p.name),
      }}
    >
      <DossierSection title="Project Information">
        <DossierKeyValue label="Project Name" value={display(p.name)} />
        <DossierKeyValue label="Project Number" value={display(p.project_number)} />
        <DossierKeyValue label="Description" value={display(p.description)} />
        <DossierKeyValue label="Start Date" value={display(p.start_date)} />
        <DossierKeyValue label="Completion Date" value={display(p.completion_date)} />
        <DossierKeyValue label="Status" value={display(p.status)} />
        <DossierKeyValue label="Project Manager" value={display(p.project_manager)} />
      </DossierSection>

      <DossierSection title="Customer Information">
        <DossierKeyValue label="Customer Name" value={display(c.name)} />
        <DossierKeyValue label="Address" value={display(c.address)} />
        <DossierKeyValue label="Contact Person" value={display(c.contact_person)} />
        <DossierKeyValue label="Country" value={display(c.country)} />
        <DossierKeyValue label="Phone" value={display(c.phone)} />
        <DossierKeyValue label="Email" value={display(c.email)} />
      </DossierSection>

      <DossierSection title="Order Information">
        <DossierKeyValue label="Order Number" value={display(o.order_number)} />
        <DossierKeyValue label="Order Date" value={display(o.order_date)} />
        <DossierKeyValue label="Delivery Date" value={display(o.delivery_date)} />
        <DossierKeyValue label="Status" value={display(o.status)} />
        <DossierKeyValue label="Quantity" value={display(o.quantity)} />
        <DossierKeyValue label="Remarks" value={display(o.remarks)} />
      </DossierSection>

      <DossierSection title="Delivery Information">
        <DossierKeyValue label="Delivery Date" value={display(d.delivery_date)} />
        <DossierKeyValue label="Delivered By" value={display(d.delivered_by)} />
        <DossierKeyValue label="Received By" value={display(d.received_by)} />
        <DossierKeyValue label="Acceptance Status" value={display(d.acceptance_status)} />
        <DossierKeyValue label="Delivery Notes" value={display(d.delivery_notes)} />
      </DossierSection>

      <DossierSection title="Product Configuration">
        <View style={dossierTableStyles.table}>
          <View style={dossierTableStyles.headerRow}>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Entity</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Part No.</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Serial</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '12%' }]}>Status</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Prev Status</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Installed</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>CI</Text>
          </View>
          {flat.map((node) => (
            <View key={`${node.entity_type}-${node.id}`} style={dossierTableStyles.row} wrap={false}>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {'  '.repeat(node.depth)}
                {node.entity_type}: {node.name}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(node.part_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(node.serial_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '12%' }]}>
                {display(node.current_status)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(node.previous_status)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(node.installation_date)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(node.configuration_item)}
              </Text>
            </View>
          ))}
        </View>
      </DossierSection>

      <DossierSection title="Configuration History">
        <View style={dossierTableStyles.table}>
          <View style={dossierTableStyles.headerRow}>
            <Text style={[dossierTableStyles.headerCell, { width: '16%' }]}>Date</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '14%' }]}>Type</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Old PN/SN</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>New PN/SN</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '16%' }]}>By</Text>
            <Text style={[dossierTableStyles.headerCell, { width: '18%' }]}>Reason</Text>
          </View>
          {(data.configuration_history || []).map((ch) => (
            <View key={ch.id} style={dossierTableStyles.row} wrap={false}>
              <Text style={[dossierTableStyles.cell, { width: '16%' }]}>
                {display(ch.change_date)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '14%' }]}>
                {display(ch.resolution_type)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(ch.old_part_number)} / {display(ch.old_serial_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(ch.new_part_number)} / {display(ch.new_serial_number)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '16%' }]}>
                {display(ch.performed_by)}
              </Text>
              <Text style={[dossierTableStyles.cell, { width: '18%' }]}>
                {display(ch.reason)}
              </Text>
            </View>
          ))}
        </View>
      </DossierSection>

      <DossierSection title="Build Timeline">
        {(data.timeline || []).map((ev, i) => (
          <View key={i} style={{ marginBottom: 4 }} wrap={false}>
            <Text>
              {display(ev.occurred_at)} — {ev.title} ({ev.event_type})
            </Text>
            {ev.description ? <Text style={{ color: '#555' }}>{ev.description}</Text> : null}
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
        <DossierKeyValue
          label="Prepared By"
          value={display(data.signatures?.prepared_by)}
        />
        <DossierKeyValue
          label="Reviewed By"
          value={display(data.signatures?.reviewed_by)}
        />
        <DossierKeyValue
          label="Approved By"
          value={display(data.signatures?.approved_by)}
        />
      </DossierSection>
    </DossierDocumentShell>
  );
}
