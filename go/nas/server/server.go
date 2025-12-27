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

package server

import (
	"net/http"
	"time"

	"github.com/saichler/l8bus/go/overlay/protocol"
	"github.com/saichler/l8bus/go/overlay/vnet"
	"github.com/saichler/l8bus/go/overlay/vnic"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/shared"
	"github.com/saichler/l8web/go/web/server"
	"github.com/saichler/nasfile/go/nas/actions"
	files2 "github.com/saichler/nasfile/go/nas/files"
	"github.com/saichler/nasfile/go/types/files"
)

func Start() {
	server.Timeout = 600
	vnetPort := uint32(15151)
	r := shared.ResourcesOf("vnet-nas", vnetPort, 0, false)
	r.Logger().SetLogLevel(ifs.Info_Level)
	net := vnet.NewVNet(r)
	net.Start()

	r.Logger().Info("vnet started!")
	r.Logger().SetLogLevel(ifs.Error_Level)
	time.Sleep(time.Second)
	startWebServer(7443, vnetPort, "files")
}

func startWebServer(port int, vnetPort uint32, cert string) {
	serverConfig := &server.RestServerConfig{
		Host:           protocol.MachineIP,
		Port:           port,
		Authentication: true,
		CertName:       cert,
		Prefix:         "/files/",
	}
	svr, err := server.NewRestServer(serverConfig)
	if err != nil {
		panic(err)
	}

	r := shared.ResourcesOf("web-nas", vnetPort, 0, false)

	r.Registry().Register(&files.File{})
	r.Registry().Register(&files.FileList{})
	r.Registry().Register(&files.Action{})
	r.Registry().Register(&files.ActionResponse{})

	nic := vnic.NewVirtualNetworkInterface(r, nil)
	nic.Resources().SysConfig().KeepAliveIntervalSeconds = 0
	nic.Start()
	nic.WaitForConnection()

	files2.Activate(nic)
	actions.Activate(nic)

	//Activate the webpoints service
	sla := ifs.NewServiceLevelAgreement(&server.WebService{}, ifs.WebService, 0, false, nil)
	sla.SetArgs(svr, nic)
	nic.Resources().Services().Activate(sla, nic)

	// Register download endpoint
	registerDownloadEndpoint(nic.Resources())

	nic.Resources().Logger().Info("Web Server Started!")

	svr.Start()
}

func registerDownloadEndpoint(resources ifs.IResources) {
	http.HandleFunc("/files/download", func(w http.ResponseWriter, r *http.Request) {
		// Check authentication
		bearer := r.Header.Get("Authorization")
		if bearer == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		_, ok := resources.Security().ValidateToken(bearer)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		actions.DownloadHandler(w, r, resources)
	})
}
