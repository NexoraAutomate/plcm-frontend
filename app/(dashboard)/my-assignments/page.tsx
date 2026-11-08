import { redirect } from 'next/navigation';

/** Parent route — send users to the BHD child (sidebar default). */
export default function MyAssignmentsIndexPage() {
  redirect('/my-assignments/bhd');
}
