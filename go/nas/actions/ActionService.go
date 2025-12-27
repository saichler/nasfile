/*
 * © 2025 Sharon Aicler (saichler@gmail.com)
 *
 * Layer 8 Ecosystem is licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at:
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package actions

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/types/l8web"
	"github.com/saichler/l8utils/go/utils/web"
	"github.com/saichler/nasfile/go/types/files"
)

const (
	ServiceName = "Actions"
	ServiceType = "ActionService"
	ServiceArea = byte(0)
)

type ActionService struct {
}

func Activate(vnic ifs.IVNic) {
	sla := ifs.NewServiceLevelAgreement(&ActionService{}, ServiceName, ServiceArea, false, nil)
	ws := web.New(ServiceName, ServiceArea, &files.Action{},
		&files.ActionResponse{}, nil, nil, nil, nil, nil, nil, nil, nil)
	sla.SetWebService(ws)
	vnic.Resources().Services().Activate(sla, vnic)
}

func (this *ActionService) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	vnic.Resources().Registry().Register(&files.File{})
	vnic.Resources().Registry().Register(&files.FileList{})
	vnic.Resources().Registry().Register(&files.Action{})
	vnic.Resources().Registry().Register(&files.ActionResponse{})
	vnic.Resources().Registry().Register(&l8web.L8Empty{})
	return nil
}

func (this *ActionService) DeActivate() error {
	return nil
}

func responde(msg string, isError bool) ifs.IElements {
	fmt.Println(msg)
	return object.New(nil, &files.ActionResponse{Msg: msg, IsError: isError})
}

func isDirectory(source, target *files.File) (string, string, error) {
	if source == nil || target == nil {
		return "", "", errors.New("source or target are nil")
	}
	sourcePath := source.Path + "/" + source.Name
	if strings.HasSuffix(sourcePath, "//") {
		sourcePath = sourcePath[1:]
	}
	_, err := os.ReadDir(sourcePath)
	if err == nil {
		source.IsDirectory = true
	} else {
		source.IsDirectory = false
		_, err = os.Stat(sourcePath)
		if err != nil {
			return "", "", errors.New("Source '" + sourcePath + "' does not exist")
		}
	}

	targetPath := target.Path + "/" + target.Name
	if strings.HasSuffix(targetPath, "//") {
		targetPath = targetPath[1:]
	}
	_, err = os.ReadDir(targetPath)
	if err == nil {
		target.IsDirectory = true
	} else {
		_, err = os.Stat(targetPath)
		if err == nil && source.IsDirectory {
			return "", "", errors.New("Target '" + targetPath + "' is a file")
		} else {
			target.IsDirectory = source.IsDirectory
		}
	}

	return "\"" + sourcePath + "\"", "\"" + targetPath + "\"", nil
}

func (this *ActionService) Post(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	ac, ok := pb.Element().(*files.Action)
	if ok {
		fmt.Println("Doing: ", ac.Action.String())
		switch ac.Action {
		case files.ActionType_copy:
			return doCopy(ac)
		case files.ActionType_cut:
			return doCut(ac)
		case files.ActionType_delete:
			return doDelete(ac)
		case files.ActionType_rename:
			return doRename(ac)
		case files.ActionType_newFolder:
			return doNewFolder(ac)
		}
	}
	return object.New(nil, &l8web.L8Empty{})
}

func doCopy(ac *files.Action) ifs.IElements {
	source, target, err := isDirectory(ac.Source, ac.Target)
	if err != nil {
		return responde(err.Error(), true)
	}

	script := ""

	if ac.Source.IsDirectory && ac.Target.IsDirectory {
		script = "bash -c 'cp -r " + source + " " + target + "'"
	} else if !ac.Source.IsDirectory && !ac.Target.IsDirectory {
		script = "bash -c 'cp " + source + " " + target + "'"
	}

	os.WriteFile("script.sh", []byte(script), 0777)
	cmd := exec.Command("bash", "-c", "./script.sh")
	out, err := cmd.Output()
	if err != nil {
		return responde(err.Error(), true)
	}
	return responde(string(out), false)
}

func doCut(ac *files.Action) ifs.IElements {
	source, target, err := isDirectory(ac.Source, ac.Target)
	if err != nil {
		return responde(err.Error(), true)
	}

	script := "bash -c 'mv " + source + " " + target + "'"
	os.WriteFile("script.sh", []byte(script), 0777)
	cmd := exec.Command("bash", "-c", "./script.sh")
	out, err := cmd.Output()
	if err != nil {
		return responde(err.Error(), true)
	}
	return responde(string(out), false)
}

func doDelete(ac *files.Action) ifs.IElements {
	sourcePath := ac.Source.Path + "/" + ac.Source.Name
	if strings.HasSuffix(sourcePath, "//") {
		sourcePath = sourcePath[1:]
	}

	sourcePath = "\"" + sourcePath + "\""

	script := "bash -c 'rm -rf " + sourcePath + "'"
	os.WriteFile("script.sh", []byte(script), 0777)
	cmd := exec.Command("bash", "-c", "./script.sh")
	out, err := cmd.Output()
	if err != nil {
		return responde(err.Error(), true)
	}
	return responde(string(out), false)
}

func doRename(ac *files.Action) ifs.IElements {
	source, target, err := isDirectory(ac.Source, ac.Target)
	if err != nil {
		return responde(err.Error(), true)
	}

	script := "bash -c 'mv " + source + " " + target + "'"
	os.WriteFile("script.sh", []byte(script), 0777)
	cmd := exec.Command("bash", "-c", "./script.sh")
	out, err := cmd.Output()
	if err != nil {
		return responde(err.Error(), true)
	}
	return responde(string(out), false)
}

func doNewFolder(ac *files.Action) ifs.IElements {
	sourcePath := ac.Source.Path + "/" + ac.Source.Name
	if strings.HasSuffix(sourcePath, "//") {
		sourcePath = sourcePath[1:]
	}
	sourcePath = "\"" + sourcePath + "\""

	script := "bash -c 'mkdir -p " + sourcePath + "'"
	os.WriteFile("script.sh", []byte(script), 0777)
	cmd := exec.Command("bash", "-c", "./script.sh")
	out, err := cmd.Output()
	if err != nil {
		return responde(err.Error(), true)
	}
	return responde(string(out), false)
}

func (this *ActionService) Put(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}

func (this *ActionService) Patch(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}

func (this *ActionService) Delete(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}

func (this *ActionService) Get(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}
func (this *ActionService) GetCopy(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}
func (this *ActionService) Failed(pb ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return nil
}
func (this *ActionService) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

func (this *ActionService) WebService() ifs.IWebService {
	ws := web.New(ServiceName, ServiceArea, &files.Action{},
		&files.ActionResponse{}, nil, nil, nil, nil, nil, nil, nil, nil)
	return ws
}

// DownloadHandler handles file download requests
func DownloadHandler(w http.ResponseWriter, r *http.Request, resources ifs.IResources) {
	// Extract path from query parameter
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "Missing path parameter", http.StatusBadRequest)
		return
	}

	// Clean the path to prevent path traversal attacks
	cleanPath := filepath.Clean(filePath)

	// Check if file exists and is not a directory
	fileInfo, err := os.Stat(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, "File not found", http.StatusNotFound)
		} else {
			http.Error(w, "Error accessing file", http.StatusInternalServerError)
		}
		return
	}

	if fileInfo.IsDir() {
		http.Error(w, "Cannot download a directory", http.StatusBadRequest)
		return
	}

	// Open the file
	file, err := os.Open(cleanPath)
	if err != nil {
		http.Error(w, "Error opening file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Set headers for download
	fileName := filepath.Base(cleanPath)
	// Properly encode filename for Content-Disposition header (RFC 5987)
	// This handles spaces, special characters, and non-ASCII characters
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", encodeRFC5987(fileName)))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))

	// Stream file to response
	_, err = io.Copy(w, file)
	if err != nil {
		resources.Logger().Error("Error streaming file: ", err)
	}
}

// encodeRFC5987 encodes a string according to RFC 5987
// This is used for encoding filenames in Content-Disposition headers
func encodeRFC5987(s string) string {
	// URL encode but keep certain characters that are allowed in RFC 5987
	encoded := url.QueryEscape(s)
	// RFC 5987 allows certain characters that QueryEscape encodes
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	return encoded
}
