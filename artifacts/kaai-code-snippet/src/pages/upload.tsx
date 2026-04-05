import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Upload as UploadIcon, CheckCircle2, Code2, AlertCircle, Send } from "lucide-react";

import { useCreateSnippet, getListSnippetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_CONFIG } from "@/lib/constants";

const formSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi").max(200, "Judul terlalu panjang"),
  description: z.string().min(1, "Deskripsi wajib diisi").max(1000, "Deskripsi terlalu panjang"),
  language: z.string().min(1, "Bahasa pemrograman wajib dipilih"),
  tags: z.string().min(1, "Minimal satu tag diperlukan (pisahkan dengan koma)"),
  code: z.string().min(1, "Kode tidak boleh kosong"),
  authorName: z.string().min(1, "Nama author wajib diisi"),
  authorEmail: z.string().email("Format email tidak valid"),
});

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      language: "javascript",
      tags: "",
      code: "",
      authorName: "",
      authorEmail: "",
    },
  });

  const createSnippet = useCreateSnippet();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const tagsArray = values.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (tagsArray.length === 0) {
        form.setError("tags", { message: "Minimal satu tag yang valid diperlukan" });
        return;
      }

      await createSnippet.mutateAsync({
        data: {
          ...values,
          tags: tagsArray,
        },
      });

      queryClient.invalidateQueries({ queryKey: getListSnippetsQueryKey() });

      setSubmitted(true);
      toast({
        title: "Kode berhasil dikirim!",
        description: "Kode kamu sedang menunggu review dari admin.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Gagal mengirim kode",
        description: "Terjadi kesalahan saat mengirim. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-card rounded-2xl p-8 text-center space-y-4"
        >
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto border border-green-500/25">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground">Terkirim!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Terima kasih sudah berkontribusi ke Kaai Code Snippet. Kode kamu sedang ditinjau oleh admin dan akan muncul di library setelah disetujui.
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <Button
              onClick={() => {
                form.reset();
                setSubmitted(false);
              }}
              variant="outline"
              data-testid="btn-submit-another"
            >
              Kirim Kode Lain
            </Button>
            <Button
              onClick={() => setLocation("/")}
              data-testid="btn-back-to-library"
            >
              Kembali ke Library
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <UploadIcon className="w-7 h-7 text-primary" />
          Kirim Kode Baru
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Bagikan kode terbaikmu ke komunitas developer Indonesia.
        </p>
      </div>

      <div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul Snippet</FormLabel>
                      <FormControl>
                        <Input placeholder="cth. React useDebounce Hook" {...field} className="bg-background/50" data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="authorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Author</FormLabel>
                        <FormControl>
                          <Input placeholder="cth. Budi Santoso" {...field} className="bg-background/50" data-testid="input-author-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="authorEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Author</FormLabel>
                        <FormControl>
                          <Input placeholder="budi@example.com" type="email" {...field} className="bg-background/50" data-testid="input-author-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bahasa</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50" data-testid="select-language">
                              <SelectValue placeholder="Pilih bahasa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(LANGUAGE_CONFIG).map(([val, config]) => (
                              <SelectItem key={val} value={val}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tag (pisahkan koma)</FormLabel>
                        <FormControl>
                          <Input placeholder="react, hooks, utilitas" {...field} className="bg-background/50" data-testid="input-tags" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deskripsi</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Jelaskan secara singkat apa yang dilakukan snippet ini..."
                          className="resize-none h-[120px] bg-background/50"
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-5 flex flex-col">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="flex-1 flex flex-col">
                      <FormLabel className="flex justify-between items-center">
                        Kode
                        <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                          <Code2 className="w-3 h-3" /> Gunakan font monospace
                        </span>
                      </FormLabel>
                      <FormControl className="flex-1">
                        <Textarea
                          placeholder="// Tempel kode kamu di sini..."
                          className="font-mono text-sm resize-none h-[360px] md:h-full bg-background/80 border-primary/20 focus-visible:ring-primary focus-visible:border-primary/50"
                          {...field}
                          spellCheck={false}
                          data-testid="input-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Semua kiriman ditinjau manual oleh admin sebelum dipublikasikan.
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={createSnippet.isPending}
                className="min-w-[150px] shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-shadow"
                data-testid="btn-submit-form"
              >
                <Send className="w-4 h-4 mr-2" />
                {createSnippet.isPending ? "Mengirim..." : "Kirim Kode"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
