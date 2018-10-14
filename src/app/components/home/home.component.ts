import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ElectronService } from '../../providers/electron.service';
const commandExistsSync = require('command-exists').sync;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  @ViewChild('dropplace')
  dropPlace: ElementRef;
  @ViewChild('generatebutton')
  generatebutton: ElementRef;
  @ViewChild('resetbutton')
  resetbutton: ElementRef;
  @ViewChild('progress')
  progressBar: ElementRef;

  CertificateSigningRequestCertSigningRequestFileName: string;
  defaultKeyFileName: string;
  iosDistributionPem: string;
  iosDistributionP12: string;

  constructor(public electronService: ElectronService) {}

  ngOnInit() {
    if (!commandExistsSync('openssl')) {
      this.electronService.remote.dialog.showMessageBox({
        type: 'error',
        buttons: ['حسنا'],
        title: 'خطا',
        message: 'لم اتمكن من العثور على openssl مثبت على جهازك؟'
      });

      return;
    }

    this.reset();

    this.dropPlace.nativeElement.ondragover = this.dropPlace.nativeElement.ondragleave = this.dropPlace.nativeElement.ondragend = () => {
      return false;
    };

    this.dropPlace.nativeElement.ondrop = e => {
      e.preventDefault();

      if (this.dropPlace.nativeElement.getAttribute('disabled')) {
        this.electronService.remote.dialog.showErrorBox(
          'خطأ',
          'لا يمكنك اسقاط اي مفتاح الا بتوليد المفاتيح.'
        );
        return;
      }

      if (e.dataTransfer.files.length !== 1) {
        this.electronService.remote.dialog.showErrorBox(
          'خطأ',
          'لا يمكنك اسقاط ملفات متعددة'
        );
        return;
      }

      const filename: string = e.dataTransfer.files[0].path;

      this.dropPlace.nativeElement.setAttribute('disabled', 'disabled');

      if (filename.match(/cer/g)) {
        this.electronService.remote.dialog.showSaveDialog(
          { defaultPath: 'ios_distribution.pem' },
          (iosDistributionPem: string) => {
            this.iosDistributionPem = iosDistributionPem;
            this.electronService.childProcess.exec(
              `openssl x509 -in ${filename} -inform DER -out ${
                this.iosDistributionPem
              } -outform PEM`,
              (error, stderr, stdout) => {
                if (error) {
                  this.reset();
                  this.electronService.remote.dialog.showErrorBox(
                    'Error',
                    `exec error: ${error}`
                  );
                  return;
                }
                this.progressBar.nativeElement.value = '3';
                this.electronService.remote.dialog.showSaveDialog(
                  { defaultPath: 'ios_distribution.p12' },
                  (iosDistributionP12: string) => {
                    this.iosDistributionP12 = iosDistributionP12;
                    const password = prompt('ادخل كلمة السر لمفاتيح');
                    if (password) {
                      const spawnPkcs12 = this.electronService.childProcess.spawn(
                        'openssl',
                        [
                          'pkcs12',
                          '-export',
                          '-inkey',
                          this.defaultKeyFileName,
                          '-in',
                          this.iosDistributionPem,
                          '-out',
                          this.iosDistributionP12,
                          '-passout',
                          'pass:' + password
                        ]
                      );

                      spawnPkcs12.stdout.on('close', () => {
                        this.electronService.remote.dialog.showMessageBox({
                          title: 'عملية ناجحة',
                          message:
                            'تم انشاء المفتاح p12 بنجاح \nمسار المفتاح: ' +
                            this.iosDistributionP12,
                          type: 'info'
                        });
                        this.progressBar.nativeElement.value = '4';
                        this.reset();
                      });
                    }
                  }
                );
              }
            );
          }
        );
      } else {
        this.electronService.remote.dialog.showErrorBox(
          'Error',
          'drag cer file from apple developer center.'
        );
      }

      return false;
    };
  }

  generateKey() {
    this.generatebutton.nativeElement.setAttribute('disabled', 'disabled');
    this.resetbutton.nativeElement.removeAttribute('disabled');
    this.progressBar.nativeElement.removeAttribute('disabled');
    this.progressBar.nativeElement.value = '0';

    this.electronService.remote.dialog.showSaveDialog(
      { defaultPath: 'default.key' },
      (defaultKeyFileName: string) => {
        if (defaultKeyFileName !== undefined) {
          this.defaultKeyFileName = defaultKeyFileName;
          const spawnGenrsa = this.electronService.childProcess.spawn('openssl', [
            'genrsa',
            '-out',
            defaultKeyFileName,
            '2048'
          ]);

          spawnGenrsa.stdout.on('data', console.log);

          spawnGenrsa.stdout.on('error', error => {
            if (error) {
              this.reset();
              this.electronService.remote.dialog.showErrorBox(
                'Error',
                `exec error: ${error}`
              );
              return;
            }
          });

          spawnGenrsa.stdout.on('close', () => {
            this.progressBar.nativeElement.value = '1';
            this.electronService.remote.dialog.showSaveDialog(
              { defaultPath: 'CertificateSigningRequest.certSigningRequest' },
              (CertificateSigningRequestCertSigningRequestFileName: string) => {
                if (
                  CertificateSigningRequestCertSigningRequestFileName !==
                  undefined
                ) {
                  this.CertificateSigningRequestCertSigningRequestFileName = CertificateSigningRequestCertSigningRequestFileName;
                  const spawnReq = this.electronService.childProcess.exec(
                    `openssl req -new -key ${this.defaultKeyFileName} -out ${
                      this.CertificateSigningRequestCertSigningRequestFileName
                    } -subj "/emailAddress=xlmnxp@outlook.sa, CN=Salem Yaslem, C=SA"`,
                    (error, stderr, stdout) => {
                      if (error) {
                        this.electronService.remote.dialog.showErrorBox(
                          'Error',
                          `exec error: ${error}`
                        );
                        this.reset();
                        return;
                      }
                      this.progressBar.nativeElement.value = '2';
                      this.dropPlace.nativeElement.removeAttribute('disabled');
                    }
                  );
                } else {
                  this.reset();
                }
              }
            );
          });
        } else {
          this.reset();
        }
      }
    );
  }

  reset() {
    this.defaultKeyFileName = '';
    this.CertificateSigningRequestCertSigningRequestFileName = '';
    this.iosDistributionPem = '';
    this.iosDistributionP12 = '';
    this.dropPlace.nativeElement.setAttribute('disabled', 'disabled');
    this.resetbutton.nativeElement.setAttribute('disabled', 'disabled');
    this.generatebutton.nativeElement.removeAttribute('disabled');
    this.progressBar.nativeElement.setAttribute('disabled', 'disabled');
    this.progressBar.nativeElement.value = '4';
  }
}
