import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, User, Mail, Utensils, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useTripWizard } from './TripWizardContext';
import { TripParticipant } from './TripWizardTypes';

const participantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  dietaryRestrictions: z.array(z.string()).default([]),
  mealCoefficient: z.number().min(0).max(2).default(1),
  isOrganizer: z.boolean().default(false),
});

type ParticipantFormData = z.infer<typeof participantSchema>;

const dietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
  'Seafood allergy',
  'Halal',
  'Kosher',
  'Other',
];

export const TripParticipantsStep: React.FC = () => {
  const { data, addParticipant, updateParticipant, removeParticipant } = useTripWizard();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<TripParticipant | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: '',
      email: '',
      dietaryRestrictions: [],
      mealCoefficient: 1,
      isOrganizer: false,
    },
  });

  const mealCoefficient = watch('mealCoefficient');
  const dietaryRestrictions = watch('dietaryRestrictions');

  const onSubmit = (formData: ParticipantFormData) => {
    if (editingParticipant) {
      updateParticipant(editingParticipant.id, formData);
    } else {
      addParticipant(formData);
    }
    handleClose();
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingParticipant(null);
    reset();
  };

  const handleEdit = (participant: TripParticipant) => {
    setEditingParticipant(participant);
    reset(participant);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      removeParticipant(id);
    }
  };

  const toggleDietaryRestriction = (restriction: string) => {
    const current = dietaryRestrictions || [];
    if (current.includes(restriction)) {
      setValue('dietaryRestrictions', current.filter((r) => r !== restriction));
    } else {
      setValue('dietaryRestrictions', [...current, restriction]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Participants</h2>
        <p className="text-gray-600">Add the people who will be joining the trip.</p>
      </div>

      {/* Add Participant Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Participant
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {editingParticipant ? 'Edit Participant' : 'Add Participant'}
              </DialogTitle>
              <DialogDescription>
                Enter the participant's details below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="required">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  {...register('name')}
                  className={cn(errors.name && 'border-red-500')}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  {...register('email')}
                  className={cn(errors.email && 'border-red-500')}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Organizer */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isOrganizer"
                  checked={watch('isOrganizer')}
                  onCheckedChange={(checked) => setValue('isOrganizer', !!checked)}
                />
                <Label
                  htmlFor="isOrganizer"
                  className="text-sm font-normal cursor-pointer"
                >
                  This person is a trip organizer
                </Label>
              </div>

              {/* Meal Coefficient */}
              <div className="space-y-2">
                <Label>
                  Meal Coefficient: {mealCoefficient.toFixed(1)}
                </Label>
                <Slider
                  value={[mealCoefficient]}
                  onValueChange={([value]) => setValue('mealCoefficient', value)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-sm text-gray-600">
                  Adjust based on appetite (0.5 for children, 1.5 for big eaters)
                </p>
              </div>

              {/* Dietary Restrictions */}
              <div className="space-y-2">
                <Label>Dietary Restrictions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {dietaryOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={option}
                        checked={dietaryRestrictions?.includes(option) || false}
                        onCheckedChange={() => toggleDietaryRestriction(option)}
                      />
                      <Label
                        htmlFor={option}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">
                {editingParticipant ? 'Update' : 'Add'} Participant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Participants List */}
      {data.participants.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No participants added yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Add at least one participant to continue.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.participants.map((participant) => (
            <div
              key={participant.id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-lg">{participant.name}</h3>
                    {participant.isOrganizer && (
                      <Badge variant="secondary" className="gap-1">
                        <Crown className="h-3 w-3" />
                        Organizer
                      </Badge>
                    )}
                  </div>
                  
                  {participant.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Mail className="h-4 w-4" />
                      {participant.email}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Utensils className="h-4 w-4" />
                    Meal coefficient: {participant.mealCoefficient}
                  </div>

                  {participant.dietaryRestrictions && participant.dietaryRestrictions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {participant.dietaryRestrictions.map((restriction) => (
                        <Badge key={restriction} variant="outline" className="text-xs">
                          {restriction}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(participant)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(participant.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {data.participants.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{data.participants.length}</strong> participant
            {data.participants.length > 1 ? 's' : ''} added •{' '}
            <strong>
              {data.participants.reduce((sum, p) => sum + p.mealCoefficient, 0).toFixed(1)}
            </strong>{' '}
            total meal portions
          </p>
        </div>
      )}
    </div>
  );
};