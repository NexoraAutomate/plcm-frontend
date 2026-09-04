'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  cabinetsForRoom,
  normalizeLocationTree,
  racksForCabinet,
  type InventoryLocationTree,
} from '@/lib/inventory-location-tree';
import { composeInventoryLocation } from '@/lib/inventory-entity-fields';

export type CascadingLocationValue = {
  location_room: string;
  location_cabinet: string;
  location_rack: string;
  location: string;
};

type Props = {
  tree: InventoryLocationTree | null | undefined;
  value: {
    location_room?: string;
    location_cabinet?: string;
    location_rack?: string;
  };
  onChange: (next: CascadingLocationValue) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function CascadingLocationSelects({
  tree,
  value,
  onChange,
  required = false,
  disabled = false,
  className,
}: Props) {
  const rooms = useMemo(() => normalizeLocationTree(tree), [tree]);
  const roomName = value.location_room || '';
  const cabinetName = value.location_cabinet || '';
  const rackName = value.location_rack || '';

  const cabinets = useMemo(() => cabinetsForRoom(rooms, roomName), [rooms, roomName]);
  const racks = useMemo(
    () => racksForCabinet(rooms, roomName, cabinetName),
    [rooms, roomName, cabinetName]
  );

  const hasTree = rooms.length > 0;

  function emit(room: string, cabinet: string, rack: string) {
    onChange({
      location_room: room,
      location_cabinet: cabinet,
      location_rack: rack,
      location: composeInventoryLocation(room, cabinet, rack),
    });
  }

  if (!hasTree) {
    return (
      <div className={className}>
        <Label>Location {required ? '*' : ''}</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Admin has not defined a Room → Cabinet → Rack tree yet. Ask Admin to set locations under
          Settings → Definitions.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Label>Location {required ? '*' : ''}</Label>
      <div className="mt-1 grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Room</Label>
          <Select
            value={roomName || '__none__'}
            onValueChange={(val) => {
              const nextRoom = val === '__none__' ? '' : val;
              emit(nextRoom, '', '');
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Room…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.name}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cabinet</Label>
          <Select
            value={cabinetName || '__none__'}
            onValueChange={(val) => {
              const nextCabinet = val === '__none__' ? '' : val;
              emit(roomName, nextCabinet, '');
            }}
            disabled={disabled || !roomName}
          >
            <SelectTrigger>
              <SelectValue placeholder="Cabinet…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {cabinets.map((cabinet) => (
                <SelectItem key={cabinet.id} value={cabinet.name}>
                  {cabinet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Rack</Label>
          <Select
            value={rackName || '__none__'}
            onValueChange={(val) => {
              const nextRack = val === '__none__' ? '' : val;
              emit(roomName, cabinetName, nextRack);
            }}
            disabled={disabled || !cabinetName}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rack…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {racks.map((rack) => (
                <SelectItem key={rack.id} value={rack.name}>
                  {rack.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
