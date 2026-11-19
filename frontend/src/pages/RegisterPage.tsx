import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, Button, Card, FormField, Input } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';
import { getAuthErrorMessage } from '@/features/auth/auth.errors';
import { MIN_PASSWORD_CHARACTERS, registerSchema, type RegisterInput } from '@/features/auth/auth.schemas';
import { applyServerErrors } from '@/lib/forms';
import { ApiError } from '@/lib/http';

// Lazy loaded, like the login page (both share the react-hook-form + Zod chunk).
export default function RegisterPage() {
  // Renamed: react-hook-form's `register` (below) connects inputs to the form.
  const { register: registerAccount } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onSubmit(values: RegisterInput) {
    try {
      const user = await registerAccount(values);
      // GuestRoute redirects on success, so the form is gone and cannot be sent a second time.
      toast.success(`Welcome, ${user.name}! Your account is ready.`);
    } catch (error) {
      if (applyServerErrors(error, setError, ['name', 'email', 'password'])) {
        return;
      }
      // A 409 has no `details`, but it is clearly about the email field, so it is shown there.
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setError('email', { message: 'An account with this email already exists.' }, { shouldFocus: true });
        return;
      }
      const message = getAuthErrorMessage(error);
      setError('root.server', { message });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Create an account</h1>
      <Card>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root?.server && <Alert variant="error">{errors.root.server.message}</Alert>}
          <FormField label="Name" error={errors.name?.message}>
            {(control) => <Input {...control} {...register('name')} autoComplete="name" />}
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            {(control) => <Input {...control} {...register('email')} type="email" autoComplete="email" />}
          </FormField>
          {/* "new-password" lets the browser's password manager suggest a strong password. */}
          <FormField
            label="Password"
            hint={`At least ${MIN_PASSWORD_CHARACTERS} characters. A few random words are easier to remember than symbols.`}
            error={errors.password?.message}
          >
            {(control) => <Input {...control} {...register('password')} type="password" autoComplete="new-password" />}
          </FormField>
          <Button type="submit" isLoading={isSubmitting}>
            Create account
          </Button>
        </form>
      </Card>
    </div>
  );
}
