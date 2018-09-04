import { Component, OnInit, ViewChild, ElementRef } from "@angular/core";
import { ElectronService } from "../../providers/electron.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"]
})
export class HomeComponent implements OnInit {
  @ViewChild("dropplace")
  dropPlace: ElementRef;
  @ViewChild("generatebutton")
  generatebutton: ElementRef;
  @ViewChild("resetbutton")
  resetbutton: ElementRef;
  @ViewChild("progress")
  progressBar: ElementRef;

  defaultKeyFileName: string;
  CertificateSigningRequestCertSigningRequestFileName: string;
  iosDistributionPem: string;
  iosDistributionP12: string;

  constructor(public electronService: ElectronService) {}

  ngOnInit() {
    this.reset();

    this.dropPlace.nativeElement.ondragover = this.dropPlace.nativeElement.ondragleave = this.dropPlace.nativeElement.ondragend = () => {
      return false;
    };

    this.dropPlace.nativeElement.ondrop = e => {
      e.preventDefault();

      if (this.dropPlace.nativeElement.getAttribute("disabled")) {
        this.electronService.remote.dialog.showErrorBox(
          "Error",
          "you can't drag file with out generate keys."
        );
        return;
      }

      if (e.dataTransfer.files.length != 1) {
        this.electronService.remote.dialog.showErrorBox(
          "Error",
          "you can't drag multifiles."
        );
        return;
      }

      let filename: string = e.dataTransfer.files[0].path;

      this.dropPlace.nativeElement.setAttribute("disabled", "disabled");

      if (filename.match(/cer/g)) {
        this.electronService.remote.dialog.showSaveDialog(
          { defaultPath: "ios_distribution.pem" },
          (iosDistributionPem: string) => {
            this.iosDistributionPem = iosDistributionPem;
            this.electronService.childProcess.exec(
              `openssl x509 -in ${filename} -inform DER -out ${this.iosDistributionPem} -outform PEM`,
              (error, stderr, stdout) => {
                if (error) {
                  this.reset();
                  this.electronService.remote.dialog.showErrorBox(
                    "Error",
                    `exec error: ${error}`
                  );
                  return;
                }
                this.electronService.remote.dialog.showSaveDialog(
                  { defaultPath: "ios_distribution.p12" },
                  (iosDistributionP12: string) => {
                    this.iosDistributionP12 = iosDistributionP12;
                    let spawnPkcs12 = this.electronService.childProcess.spawn('openssl',[
                      "pkcs12",
                      "-export",
                      "-inkey",
                      this.defaultKeyFileName,
                      "-in",
                      this.iosDistributionPem,
                      "-out",
                      this.iosDistributionP12
                    ]);

                    spawnPkcs12.stdout.on('data', data => {
                      this.progressBar.nativeElement.value = "60";
                      if(data.toString().match(/password/g)){
                        // TODO: add password prompt 
                        // this.electronService.remote.dialog.showMessageBox()
                      }
                    });

                    this.reset();
                  }
                );
              }
            );
          }
        );
      } else {
        this.electronService.remote.dialog.showErrorBox(
          "Error",
          "drag cer file from apple developer center."
        );
      }

      return false;
    };
  }

  generateKey() {
    this.generatebutton.nativeElement.setAttribute("disabled", "disabled");
    this.resetbutton.nativeElement.removeAttribute("disabled");
    this.progressBar.nativeElement.removeAttribute("disabled");
    this.progressBar.nativeElement.value = "0";

    this.electronService.remote.dialog.showSaveDialog(
      { defaultPath: "default.key" },
      (defaultKeyFileName: string) => {
        if (defaultKeyFileName != undefined) {
          this.defaultKeyFileName = defaultKeyFileName;
          let spawnGenrsa = this.electronService.childProcess.spawn("openssl", [
            "genrsa",
            "-out",
            defaultKeyFileName,
            "2048"
          ]);

          spawnGenrsa.stdout.on("data", console.log);

          spawnGenrsa.stdout.on("error", error => {
            if (error) {
              this.reset();
              this.electronService.remote.dialog.showErrorBox(
                "Error",
                `exec error: ${error}`
              );
              return;
            }
          });

          spawnGenrsa.stdout.on("close", () => {
            this.progressBar.nativeElement.value = "20";
            this.electronService.remote.dialog.showSaveDialog(
              { defaultPath: "CertificateSigningRequest.certSigningRequest" },
              (CertificateSigningRequestCertSigningRequestFileName: string) => {
                if (
                  CertificateSigningRequestCertSigningRequestFileName != undefined
                ) {
                  this.CertificateSigningRequestCertSigningRequestFileName = CertificateSigningRequestCertSigningRequestFileName;
                  let spawnReq = this.electronService.childProcess.exec(
                    `openssl req -new -key ${this.defaultKeyFileName} -out ${this.CertificateSigningRequestCertSigningRequestFileName} -subj "/emailAddress=xlmnxp@outlook.sa, CN=Salem Yaslem, C=SA"`,
                    (error, stderr, stdout) => {
                      if (error) {
                        this.electronService.remote.dialog.showErrorBox(
                          "Error",
                          `exec error: ${error}`
                        );
                        this.reset();
                        return;
                      }
                      this.progressBar.nativeElement.value = "40";
                      this.dropPlace.nativeElement.removeAttribute("disabled");
                    }
                  );
                }else{
                  this.reset();
                }
              }
            );
          });
        }else{
          this.reset();
        }
      }
    );
  }

  reset() {
    this.defaultKeyFileName = "";
    this.CertificateSigningRequestCertSigningRequestFileName = "";
    this.iosDistributionPem = "";
    this.iosDistributionP12 = "";
    this.dropPlace.nativeElement.setAttribute("disabled", "disabled");
    this.resetbutton.nativeElement.setAttribute("disabled", "disabled");
    this.generatebutton.nativeElement.removeAttribute("disabled");
    this.progressBar.nativeElement.setAttribute("disabled", "disabled");
    this.progressBar.nativeElement.value = "100";
  }
}
