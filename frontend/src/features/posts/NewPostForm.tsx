import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, Button, FormField, Input, Textarea } from '@/components/ui';
import { getAuthErrorMessage } from '@/features/auth/auth.errors';
import { applyServerErrors } from '@/lib/forms';
import { createPost, type Post } from './posts.api';
import { createPostSchema, type CreatePostInput } from './posts.schemas';

type NewPostFormProps = {
  onCreated: (post: Post) => void;
};

export function NewPostForm({ onCreated }: NewPostFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: '', content: '' },
  });

  async function onSubmit(values: CreatePostInput) {
    try {
      const post = await createPost(values);
      onCreated(post);
      toast.success('Post published');
      reset();
    } catch (error) {
      if (applyServerErrors(error, setError, ['title', 'content'])) {
        return;
      }
      // Maps by error type and code (rate limit, timeout, offline), never the server's text; it is not auth-specific.
      const message = getAuthErrorMessage(error);
      setError('root.server', { message });
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root?.server && <Alert variant="error">{errors.root.server.message}</Alert>}
      <FormField label="Title" error={errors.title?.message}>
        {(control) => <Input {...control} {...register('title')} />}
      </FormField>
      <FormField label="Content" error={errors.content?.message}>
        {(control) => <Textarea {...control} {...register('content')} rows={4} />}
      </FormField>
      <Button type="submit" isLoading={isSubmitting}>
        Publish
      </Button>
    </form>
  );
}
