import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Kebijakan Privasi</h1>
            <p className="text-sm text-muted-foreground">Terakhir diperbarui: 5 April 2025</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none text-muted-foreground space-y-8">
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <p className="text-sm text-blue-300 font-medium leading-relaxed">
              Kami berkomitmen penuh untuk melindungi privasi Anda. <strong>Email Anda tidak akan pernah kami publikasikan atau tampilkan kepada publik.</strong> Email hanya digunakan sebagai sarana komunikasi resmi antara kami dan Anda.
            </p>
          </div>

          <p className="text-base leading-relaxed">
            Kebijakan Privasi ini menjelaskan bagaimana Kaai Code Snippet ("kami", "platform", atau "layanan") mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda. Dengan menggunakan layanan kami, Anda menyetujui praktik-praktik yang dijelaskan dalam kebijakan ini.
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">1. Informasi yang Kami Kumpulkan</h2>
            <div className="space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="font-medium text-foreground mb-1">1.1. Informasi yang Anda Berikan</h3>
                <p>Ketika Anda mengunggah kode ke platform kami, kami mengumpulkan:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                  <li>Nama pengguna atau nama pena (tidak harus nama asli)</li>
                  <li>Alamat email (untuk komunikasi dan notifikasi)</li>
                  <li>Kode yang Anda unggah beserta judul, deskripsi, dan tag</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">1.2. Informasi yang Dikumpulkan Secara Otomatis</h3>
                <p>Kami mengumpulkan informasi teknis secara otomatis meliputi:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                  <li>Alamat IP (digunakan untuk keamanan dan pencegahan penyalahgunaan)</li>
                  <li>Data statistik penggunaan (jumlah kunjungan, snippet yang dilihat)</li>
                  <li>Informasi browser dan perangkat (untuk optimasi tampilan)</li>
                  <li>Log aktivitas (untuk keperluan keamanan dan debugging)</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">2. Penggunaan Email Anda</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p><strong className="text-foreground">Email Anda bersifat privat dan TIDAK AKAN pernah ditampilkan kepada publik.</strong></p>
              <p>Email yang Anda berikan hanya digunakan untuk keperluan berikut:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Mengirimkan notifikasi ketika kode Anda disetujui oleh admin</li>
                <li>Mengirimkan pemberitahuan ketika kode Anda ditolak beserta alasannya</li>
                <li>Mengirimkan pengumuman penting terkait platform</li>
                <li>Komunikasi yang diperlukan terkait konten yang Anda unggah</li>
              </ul>
              <p className="mt-3">Kami tidak akan pernah:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Menjual atau menyewakan email Anda kepada pihak ketiga</li>
                <li>Menggunakan email Anda untuk keperluan pemasaran tanpa izin eksplisit</li>
                <li>Menampilkan email Anda di halaman publik platform</li>
                <li>Membagikan email Anda kepada pengguna lain</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">3. Penyimpanan dan Keamanan Data</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>3.1. Data Anda disimpan dalam database yang terenkripsi dan aman dengan akses yang dibatasi ketat.</p>
              <p>3.2. Kami menggunakan protokol HTTPS untuk mengenkripsi semua komunikasi antara browser Anda dan server kami.</p>
              <p>3.3. Akses admin ke data pengguna menggunakan sistem autentikasi multi-faktor (OTP via email) untuk memastikan keamanan.</p>
              <p>3.4. Log aktivitas disimpan untuk keperluan keamanan dan audit selama maksimal 90 hari.</p>
              <p>3.5. Data kode yang Anda unggah dapat dicadangkan ke repositori GitHub privat kami untuk tujuan pemulihan bencana.</p>
              <p>3.6. Meskipun kami mengambil langkah-langkah keamanan yang wajar, tidak ada sistem yang 100% aman. Kami menyarankan Anda untuk tidak mengunggah informasi sensitif seperti password, API key, atau token autentikasi.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">4. Hak Kode yang Anda Unggah</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>4.1. Kode yang Anda unggah ditampilkan secara publik setelah mendapat persetujuan admin.</p>
              <p>4.2. Jika kode yang Anda unggah bukan milik Anda sepenuhnya, Anda wajib mencantumkan sumber dan atribusi yang tepat. Hal ini untuk menghormati hak cipta pemilik asli dan menghindari masalah hukum.</p>
              <p>4.3. Jika terjadi klaim hak cipta terhadap konten yang Anda unggah, kami berhak menghapus konten tersebut dan memberitahu Anda melalui email.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">5. Cookie dan Teknologi Serupa</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>5.1. Kami menggunakan cookie sesi untuk admin panel guna mempertahankan status autentikasi selama 24 jam.</p>
              <p>5.2. Kami tidak menggunakan cookie pelacak komersial atau pixel tracking pihak ketiga.</p>
              <p>5.3. Data statistik (jumlah view, copy) dikumpulkan untuk menampilkan konten terpopuler di halaman utama, tanpa mengidentifikasi pengguna secara individual.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">6. Kondisi Pemblokiran Otomatis</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>6.1. Sistem kami secara otomatis mencatat alamat IP yang melakukan percobaan akses yang mencurigakan.</p>
              <p>6.2. IP yang terdeteksi melakukan serangan brute force atau upaya masuk admin yang berulang kali gagal akan diblokir sementara selama 24 jam.</p>
              <p>6.3. Email yang terdeteksi melakukan percobaan login admin yang tidak sah akan diblokir sementara selama 5 menit.</p>
              <p>6.4. Data pemblokiran ini disimpan untuk keperluan keamanan dan akan dihapus setelah masa blokir berakhir.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">7. Berbagi Data dengan Pihak Ketiga</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>7.1. Kami tidak menjual, menyewakan, atau menukar data pribadi Anda kepada pihak ketiga manapun.</p>
              <p>7.2. Kami mungkin menggunakan layanan infrastruktur pihak ketiga (seperti hosting dan database) yang tunduk pada kebijakan privasi mereka sendiri. Kami memilih mitra yang memiliki standar keamanan tinggi.</p>
              <p>7.3. Kode yang disetujui dapat dicadangkan ke GitHub sesuai dengan perjanjian privasi GitHub.</p>
              <p>7.4. Kami dapat mengungkapkan data jika diwajibkan oleh hukum atau perintah pengadilan yang sah.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">8. Hak-Hak Anda</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>Anda memiliki hak berikut terkait data pribadi Anda:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-foreground">Akses:</strong> Meminta informasi tentang data yang kami simpan tentang Anda</li>
                <li><strong className="text-foreground">Koreksi:</strong> Meminta perbaikan data yang tidak akurat</li>
                <li><strong className="text-foreground">Penghapusan:</strong> Meminta penghapusan data dan kode yang Anda unggah</li>
                <li><strong className="text-foreground">Keberatan:</strong> Menolak pemrosesan data untuk tujuan tertentu</li>
              </ul>
              <p className="mt-2">Untuk mengajukan permintaan terkait hak-hak di atas, hubungi kami melalui saluran yang tersedia.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">9. Perubahan Kebijakan Privasi</h2>
            <div className="space-y-2 text-sm leading-relaxed">
              <p>9.1. Kami berhak memperbarui kebijakan privasi ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui email kepada pengguna terdaftar.</p>
              <p>9.2. Tanggal pembaruan terakhir selalu dicantumkan di bagian atas halaman ini.</p>
              <p>9.3. Penggunaan berkelanjutan layanan kami setelah perubahan diterbitkan berarti Anda menerima kebijakan yang diperbarui.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-heading font-semibold text-foreground">10. Hubungi Kami</h2>
            <p className="text-sm leading-relaxed">
              Jika Anda memiliki pertanyaan, kekhawatiran, atau permintaan terkait kebijakan privasi ini atau data pribadi Anda, silakan hubungi kami:
            </p>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-2">
              <p className="text-sm">Layanan aduan dan balasan: <a href="https://t.me/akamodebaik" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">t.me/akamodebaik</a></p>
              <p className="text-sm">Website: <a href="https://akadev.me" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">akadev.me</a></p>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
