/** Display toggles for configuration tree node detail lines. */

export type ConfigTreeNodeFieldVisibility = {
  abbreviation: boolean;
  level: boolean;
  inventorySource: boolean;
  description: boolean;
};

export const DEFAULT_CONFIG_TREE_NODE_FIELD_VISIBILITY: ConfigTreeNodeFieldVisibility =
  {
    abbreviation: true,
    level: true,
    inventorySource: true,
    description: false,
  };

export const CONFIG_TREE_NODE_FIELD_OPTIONS: Array<{
  key: keyof ConfigTreeNodeFieldVisibility;
  label: string;
}> = [
  { key: 'abbreviation', label: 'Abbreviation' },
  { key: 'level', label: 'Level' },
  { key: 'inventorySource', label: 'Turnkey / Build' },
  { key: 'description', label: 'Description' },
];

export const CONFIG_TREE_FIELD_VISIBILITY_KEYS =
  CONFIG_TREE_NODE_FIELD_OPTIONS.map((o) => o.key);
