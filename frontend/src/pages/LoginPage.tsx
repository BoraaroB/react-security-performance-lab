import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Alert, Button, Card, FormField, Input } from '@/components/ui';
import { GITHUB_LOGIN_URL, login } from '@/features/auth/auth.api';
import { getAuthErrorMessage, getOAuthErrorMessage } from '@/features/auth/auth.errors';
import { loginSchema, type LoginInput } from '@/features/auth/auth.schemas';
import { applyServerErrors } from '@/lib/forms';

// Lazy loaded: react-hook-form and Zod are downloaded only by visitors who open this page.
export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const oauthErrorMessage = getOAuthErrorMessage(searchParams.get('error'));
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
    // The GitHub error belongs to an older attempt: remove it, so it does not stand next to this attempt's result.
    if (searchParams.has('error')) {
      setSearchParams(
        (params) => {
          params.delete('error');
          return params;
        },
        { replace: true },
      );
    }
    try {
      const { user } = await login(values);
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
      {oauthErrorMessage && <Alert variant="error">{oauthErrorMessage}</Alert>}
      <Card className="space-y-4">
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
        {/* A plain link, not fetch: OAuth needs a top-level navigation, the user must see and use GitHub's own page.
            fetch only hands the response to JavaScript (and the redirect to github.com would fail on CORS). */}
        <a
          href={GITHUB_LOGIN_URL}
          className="flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Log in with GitHub
        </a>
      </Card>
    </div>
  );
}
