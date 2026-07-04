'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EntityPicture } from '@/components/entity-picture';
import { isExternalPictureUrl } from '@/lib/picture-url';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'file' | 'picture';
  required: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: number | string }>;
  accept?: string;
  ownerType?: string;
  ownerId?: number;
}

interface EntityFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isLoading?: boolean;
  onCancel?: () => void;
  initialValues?: Record<string, any>;
  submitLabel?: string;
}

export function EntityForm({
  onSubmit,
  fields,
  isLoading = false,
  onCancel,
  initialValues = {},
  submitLabel = 'Save',
}: EntityFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({
    picture_file: null,
    remove_picture: false,
    ...initialValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const picturePreviewSrc =
    !formData.remove_picture &&
    typeof formData.picture_url === 'string' &&
    formData.picture_url
      ? formData.picture_url
      : null;

  const hasPicturePreview = Boolean(filePreviewUrl || picturePreviewSrc);

  useEffect(() => {
    const file = formData.picture_file;
    if (!(file instanceof File)) {
      setFilePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [formData.picture_file]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(field => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>

          {field.type === 'text' && (
            <Input
              id={field.name}
              placeholder={field.placeholder}
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className={errors[field.name] ? 'border-red-500' : ''}
            />
          )}

          {field.type === 'textarea' && (
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className={errors[field.name] ? 'border-red-500' : ''}
            />
          )}

          {field.type === 'select' && (
            <Select 
              value={formData[field.name]?.toString() || ''} 
              onValueChange={(value) => {
                setFormData({ ...formData, [field.name]: value });
              }}
            >
              <SelectTrigger className={errors[field.name] ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options && field.options.map(opt => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'number' && (
            <Input
              id={field.name}
              type="number"
              placeholder={field.placeholder}
              value={formData[field.name] ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  [field.name]: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              className={errors[field.name] ? 'border-red-500' : ''}
            />
          )}

          {field.type === 'date' && (
            <Input
              id={field.name}
              type="date"
              value={formData[field.name] || ''}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className={errors[field.name] ? 'border-red-500' : ''}
            />
          )}

          {field.type === 'file' && (
            <Input
              id={field.name}
              type="file"
              accept={field.accept}
              onChange={(e) =>
                setFormData({ ...formData, [field.name]: e.target.files?.[0] ?? null })
              }
              className={errors[field.name] ? 'border-red-500' : ''}
            />
          )}

          {field.type === 'picture' && (
            <div className="space-y-3">
              <Input
                id={field.name}
                placeholder={field.placeholder || 'Path or URL to entity photo'}
                value={formData.picture_url || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    picture_url: e.target.value,
                    remove_picture: false,
                  })
                }
                className={errors[field.name] ? 'border-red-500' : ''}
              />
              <div className="space-y-2">
                <Label htmlFor={`${field.name}-file`} className="text-sm font-normal text-muted-foreground">
                  Or upload a photo
                </Label>
                <Input
                  id={`${field.name}-file`}
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      picture_file: e.target.files?.[0] ?? null,
                      remove_picture: false,
                    })
                  }
                />
              </div>
              {hasPicturePreview ? (
                <div className="space-y-2">
                  {filePreviewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={filePreviewUrl}
                      alt="Selected photo preview"
                      className="max-h-32 rounded-md border object-cover"
                    />
                  ) : picturePreviewSrc && isExternalPictureUrl(picturePreviewSrc) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={picturePreviewSrc}
                      alt="Preview"
                      className="max-h-32 rounded-md border object-cover"
                    />
                  ) : picturePreviewSrc && field.ownerType && field.ownerId ? (
                    <EntityPicture
                      src={picturePreviewSrc}
                      ownerType={field.ownerType}
                      ownerId={field.ownerId}
                      alt="Preview"
                      className="max-h-32 rounded-md border object-cover"
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        picture_url: '',
                        picture_file: null,
                        remove_picture: true,
                      })
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove photo
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {field.name === 'picture_url' && field.type === 'text' && typeof formData.picture_url === 'string' && formData.picture_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={formData.picture_url}
              alt="Preview"
              className="mt-2 max-h-32 rounded-md border object-cover"
            />
          ) : null}

          {errors[field.name] && (
            <p className="text-sm text-red-500">{errors[field.name]}</p>
          )}
        </div>
      ))}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting || isLoading ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
