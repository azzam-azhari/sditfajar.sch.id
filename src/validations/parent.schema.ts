import { z } from 'zod';

export const PARENT_RELATIONSHIPS = ['Ayah', 'Ibu', 'Wali', 'Orang Tua'] as const;

/** Tautkan satu murid ke akun wali murid (satu wali boleh punya banyak anak). */
export const linkParentStudentSchema = z.object({
  parent_id: z.guid('Wali murid tidak valid.'),
  student_id: z.guid('Pilih murid yang akan ditautkan.'),
  relationship: z.enum(PARENT_RELATIONSHIPS, { message: 'Pilih hubungan dengan murid.' }),
});

export type LinkParentStudentInput = z.infer<typeof linkParentStudentSchema>;
