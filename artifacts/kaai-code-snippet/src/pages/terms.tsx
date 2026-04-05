import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto w-full pb-16"
    >
      <div className="mb-6">
        <Button variant="ghost" asChild className="pl-0 hover:bg-transparent hover:text-primary text-muted-foreground">
          <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Kembali</Link>
        </Button>
      </div>

      <div className="glass-card rounded-2xl p-8 md:p-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Syarat dan Ketentuan</h1>
            <p className="text-sm text-muted-foreground">Terakhir diperbarui: 5 April 2025</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none text-muted-foreground space-y-8">
          <p className="text-base leading-relaxed">
            Dengan mengakses dan menggunakan layanan Kaai Code Snippet, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan yang tercantum di bawah ini. Jika Anda tidak menyetujui syarat-syarat ini, mohon untuk tidak menggunakan layanan kami.
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">1. Definisi</h2>
            <p className="text-sm leading-relaxed">
              "Layanan" merujuk pada platform Kaai Code Snippet yang dapat diakses melalui situs web kami. "Pengguna" adalah siapa pun yang mengakses atau menggunakan layanan kami. "Konten" adalah semua informasi, kode, teks, atau materi lainnya yang dikirimkan atau diunggah ke platform kami. "Admin" adalah individu yang ditunjuk untuk mengelola dan memoderasi konten platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">2. Penggunaan Layanan</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>2.1. Layanan kami tersedia untuk umum. Namun, pengunggahan kode memerlukan penyediaan nama dan alamat email yang valid.</p>
              <p>2.2. Anda bertanggung jawab atas semua aktivitas yang terjadi melalui akun atau sesi penggunaan Anda.</p>
              <p>2.3. Anda setuju untuk tidak menggunakan layanan kami untuk tujuan yang melanggar hukum, termasuk namun tidak terbatas pada penipuan, penyebaran malware, atau pelanggaran hak cipta.</p>
              <p>2.4. Kami berhak untuk menangguhkan atau menghentikan akses Anda jika kami menduga adanya pelanggaran terhadap syarat dan ketentuan ini.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">3. Konten yang Diunggah</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>3.1. Dengan mengunggah kode ke platform kami, Anda menyatakan bahwa Anda memiliki hak untuk membagikan konten tersebut, atau telah mendapatkan izin yang diperlukan dari pemilik hak cipta.</p>
              <p>3.2. Jika kode yang diunggah bukan milik Anda sepenuhnya, Anda wajib mencantumkan keterangan sumber dan atribusi yang jelas untuk menghindari masalah hak kekayaan intelektual.</p>
              <p>3.3. Konten yang diunggah akan melalui proses review oleh tim admin kami sebelum dipublikasikan. Admin berhak menolak konten yang tidak memenuhi standar kualitas atau melanggar ketentuan kami.</p>
              <p>3.4. Konten yang dilarang meliputi: kode berbahaya (malware, virus, ransomware), kode yang melanggar privasi pihak ketiga, konten yang mengandung informasi sensitif (password, API key, token), dan konten yang melanggar hukum yang berlaku.</p>
              <p>3.5. Kami berhak menghapus konten yang melanggar ketentuan kami tanpa pemberitahuan sebelumnya.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">4. Hak Kekayaan Intelektual</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>4.1. Anda tetap memiliki hak atas kode yang Anda unggah. Dengan mengunggah ke platform kami, Anda memberikan kami lisensi non-eksklusif untuk menampilkan dan mendistribusikan konten tersebut dalam layanan kami.</p>
              <p>4.2. Desain, logo, merek, dan elemen visual platform Kaai Code Snippet adalah milik kami dan dilindungi oleh hukum hak cipta.</p>
              <p>4.3. Jika Anda percaya bahwa konten di platform kami melanggar hak cipta Anda, silakan hubungi kami melalui saluran aduan yang tersedia.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">5. Keamanan dan Perilaku Pengguna</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>5.1. Anda dilarang keras melakukan aktivitas yang dapat membahayakan keamanan platform, termasuk serangan DDoS, SQL injection, brute force, atau eksploitasi kerentanan keamanan lainnya.</p>
              <p>5.2. Upaya tidak sah untuk mengakses bagian admin atau informasi pengguna lain akan mengakibatkan pemblokiran permanen dan dapat dilaporkan kepada pihak berwajib.</p>
              <p>5.3. Kami menggunakan sistem pembatasan laju (rate limiting) dan pemblokiran IP/email otomatis untuk melindungi platform dari penyalahgunaan.</p>
              <p>5.4. Pengguna yang terdeteksi melakukan percobaan login berulang yang gagal atau aktivitas mencurigakan akan diblokir sementara atau permanen.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">6. Moderasi Konten</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>6.1. Semua kode yang diunggah akan ditinjau secara manual oleh tim admin kami. Proses review dapat memakan waktu 1-48 jam.</p>
              <p>6.2. Admin berhak menyetujui atau menolak kode berdasarkan standar kualitas dan kebijakan konten kami.</p>
              <p>6.3. Jika kode ditolak, Anda akan menerima notifikasi email beserta alasan penolakan. Anda dapat memperbaiki dan mengajukan kembali kode tersebut.</p>
              <p>6.4. Kami tidak bertanggung jawab atas kerugian yang mungkin timbul akibat penolakan konten yang Anda ajukan.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">7. Penolakan Garansi</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>7.1. Layanan kami disediakan "sebagaimana adanya" tanpa jaminan apapun, baik tersurat maupun tersirat.</p>
              <p>7.2. Kami tidak menjamin bahwa kode yang dipublikasikan di platform kami bebas dari bug, kerentanan keamanan, atau kesalahan.</p>
              <p>7.3. Penggunaan kode dari platform kami sepenuhnya merupakan risiko Anda sendiri. Selalu lakukan pengujian menyeluruh sebelum menggunakan kode dalam lingkungan produksi.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">8. Batasan Tanggung Jawab</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>8.1. Kami tidak bertanggung jawab atas kerusakan langsung, tidak langsung, insidental, atau konsekuensial yang timbul dari penggunaan layanan kami.</p>
              <p>8.2. Kami tidak bertanggung jawab atas kerugian data, gangguan bisnis, atau kerusakan lainnya yang mungkin terjadi akibat penggunaan konten dari platform kami.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">9. Perubahan Layanan</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>9.1. Kami berhak mengubah, menangguhkan, atau menghentikan layanan kapan saja tanpa pemberitahuan sebelumnya.</p>
              <p>9.2. Kami berhak memperbarui syarat dan ketentuan ini sewaktu-waktu. Perubahan akan berlaku efektif segera setelah dipublikasikan.</p>
              <p>9.3. Penggunaan berkelanjutan Anda atas layanan setelah perubahan diterbitkan berarti Anda menyetujui syarat dan ketentuan yang diperbarui.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">10. Hukum yang Berlaku</h2>
            <p className="text-sm leading-relaxed">
              Syarat dan ketentuan ini diatur oleh dan ditafsirkan sesuai dengan hukum yang berlaku di Indonesia. Setiap sengketa yang timbul dari syarat dan ketentuan ini akan diselesaikan melalui musyawarah mufakat terlebih dahulu.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">11. Hubungi Kami</h2>
            <p className="text-sm leading-relaxed">
              Jika Anda memiliki pertanyaan mengenai syarat dan ketentuan ini, silakan hubungi kami melalui:
            </p>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
              <p className="text-sm">Layanan aduan dan balasan: <a href="https://t.me/akamodebaik" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">t.me/akamodebaik</a></p>
              <p className="text-sm mt-1">Website: <a href="https://akadev.me" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">akadev.me</a></p>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
