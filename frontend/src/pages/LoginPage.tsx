import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, Button, Card, FormField, Input } from '@/components/ui';
import { login } from '@/features/auth/auth.api';
import { getAuthErrorMessage } from '@/features/auth/auth.errors';
import { loginSchema, type LoginInput } from '@/features/auth/auth.schemas';
import { applyServerErrors } from '@/lib/forms';

// Lazy loaded: react-hook-form and Zod are downloaded only by visitors who open this page.
export default function LoginPage() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    try {
      const { user } = await login(values);
      // The access token is not used yet: step 21 keeps it in memory.
      toast.success(`Logged in as ${user.name}`);
    } catch (error) {
      if (applyServerErrors(error, setError, ['email', 'password'])) {
        return;
      }
      const message = getAuthErrorMessage(error);
      // `root.*` errors belong to the whole form; react-hook-form clears them on the next submit.
      setError('root.server', { message });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Log in</h1>
      <Card>
        {/* `noValidate`: Zod checks the fields, so the errors look the same everywhere and are linked to the input. */}
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root?.server && <Alert variant="error">{errors.root.server.message}</Alert>}
          <FormField label="Email" error={errors.email?.message}>
            {(control) => <Input {...control} {...register('email')} type="email" autoComplete="email" />}
          </FormField>
          <FormField label="Password" error={errors.password?.message}>
            {(control) => (
              <Input {...control} {...register('password')} type="password" autoComplete="current-password" />
            )}
          </FormField>
          <Button type="submit" isLoading={isSubmitting}>
            Log in
          </Button>
        </form>
      </Card>
    </div>
  );
}
