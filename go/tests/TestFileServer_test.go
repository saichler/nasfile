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

package tests

import (
	"fmt"
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/saichler/l8bus/go/overlay/protocol"
	"github.com/saichler/l8types/go/types/l8api"
	"github.com/saichler/l8utils/go/utils/shared"
	"github.com/saichler/l8web/go/web/client"
	"github.com/saichler/nasfile/go/nas/server"
	"github.com/saichler/nasfile/go/types/files"
	"google.golang.org/protobuf/encoding/protojson"
)

func TestFileServer(t *testing.T) {
	exec.Command("rm", "-rf", "./web").Run()
	time.Sleep(time.Second * 1)
	os.CopyFS("./web", os.DirFS("../nas/web/web"))
	defer exec.Command("rm", "-rf", "./web").Run()

	go server.Start()
	time.Sleep(time.Second * 5)

	rc, ok := createRestClient(t, &files.FileList{}, "/files/")
	if !ok {
		t.Fail()
		return
	}
	f := &files.File{}
	f.Name = "home"
	f.Path = "/"
	f.IsDirectory = true

	jsn, _ := protojson.Marshal(f)
	fmt.Println("input: ", string(jsn))

	resp, err := rc.POST("0/Files", "FileList", "", "", f)
	if err != nil {
		t.Fail()
		fmt.Println(err)
		return
	}

	jsn, _ = protojson.Marshal(resp)
	fmt.Println("resp: ", string(jsn))

	actn := &files.Action{}
	actn.Action = files.ActionType_copy
	actn.Source = &files.File{Path: "/home/saichler/src", Name: "MessageMarsha.go", IsDirectory: false}
	actn.Target = &files.File{Path: "/home/saichler", Name: "tar", IsDirectory: true}

	jsn, _ = protojson.Marshal(actn)
	fmt.Println("input: ", string(jsn))

	resp, err = rc.POST("0/Actions", "ActionResponse", "", "", actn)
	if err != nil {
		t.Fail()
		fmt.Println(err)
		return
	}

	jsn, _ = protojson.Marshal(resp)
	fmt.Println("resp: ", string(jsn))

	time.Sleep(time.Second * 300)
}

func createRestClient(t *testing.T, pb interface{}, prefix string) (*client.RestClient, bool) {
	resources := shared.ResourcesOf("Client", 15151, 0, false)
	resources.Registry().Register(files.Action{})
	resources.Registry().Register(files.ActionResponse{})
	resources.Registry().Register(files.File{})
	resources.Registry().Register(files.FileList{})
	clientConfig := &client.RestClientConfig{
		Host:          protocol.MachineIP,
		Port:          7443,
		Https:         true,
		TokenRequired: true,
		CertFileName:  "files.crt",
		Prefix:        prefix,
		AuthInfo: &client.RestAuthInfo{
			NeedAuth:   true,
			BodyType:   "AuthUser",
			UserField:  "User",
			PassField:  "Pass",
			RespType:   "AuthToken",
			TokenField: "Token",
			AuthPath:   "/auth",
		},
	}
	//resources.Registry().Register(&l8api.AuthToken{})
	restClient, err := client.NewRestClient(clientConfig, resources)
	if err != nil {
		resources.Logger().Fail(t, err)
		return nil, false
	}
	resources.Registry().Register(pb)
	resources.Registry().Register(&l8api.AuthToken{})
	err = restClient.Auth("admin", "admin")
	if err != nil {
		panic(err)
	}
	return restClient, true
}
