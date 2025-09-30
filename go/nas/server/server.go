package server

import (
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/saichler/l8bus/go/overlay/protocol"
	"github.com/saichler/l8bus/go/overlay/vnet"
	"github.com/saichler/l8bus/go/overlay/vnic"
	"github.com/saichler/l8reflect/go/reflect/introspecting"
	"github.com/saichler/l8services/go/services/manager"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/types/l8health"
	"github.com/saichler/l8types/go/types/l8sysconfig"
	"github.com/saichler/l8types/go/types/l8web"
	"github.com/saichler/l8utils/go/utils/logger"
	"github.com/saichler/l8utils/go/utils/registry"
	"github.com/saichler/l8utils/go/utils/resources"
	"github.com/saichler/l8web/go/web/server"
	"github.com/saichler/nasfile/go/nas/actions"
	files2 "github.com/saichler/nasfile/go/nas/files"
	"github.com/saichler/nasfile/go/types/files"
)

func Start() {
	server.Timeout = 600
	resources := Resources("vnet-" + os.Getenv("HOSTNAME"))
	resources.Logger().SetLogLevel(ifs.Info_Level)
	net := vnet.NewVNet(resources)
	net.Start()
	resources.Logger().Info("vnet started!")
	resources.Logger().SetLogLevel(ifs.Error_Level)
	time.Sleep(time.Second)
	startWebServer(7443, "files")
}

func startWebServer(port int, cert string) {
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

	resources := Resources("web-" + os.Getenv("HOSTNAME"))

	resources.Registry().Register(&files.File{})
	resources.Registry().Register(&files.FileList{})
	resources.Registry().Register(&l8web.L8Empty{})
	resources.Registry().Register(&l8health.L8Top{})
	resources.Registry().Register(&files.Action{})
	resources.Registry().Register(&files.ActionResponse{})

	nic := vnic.NewVirtualNetworkInterface(resources, nil)
	nic.Resources().SysConfig().KeepAliveIntervalSeconds = 0
	nic.Start()
	nic.WaitForConnection()

	nic.Resources().Services().RegisterServiceHandlerType(&files2.FileService{})
	_, err = nic.Resources().Services().Activate(files2.ServiceType, files2.ServiceName,
		files2.ServiceArea, nic.Resources(), nic, svr)

	nic.Resources().Services().RegisterServiceHandlerType(&actions.ActionService{})
	_, err = nic.Resources().Services().Activate(actions.ServiceType, actions.ServiceName,
		actions.ServiceArea, nic.Resources(), nic, svr)

	//Activate the webpoints service
	nic.Resources().Services().RegisterServiceHandlerType(&server.WebService{})
	_, err = nic.Resources().Services().Activate(server.ServiceTypeName, ifs.WebService,
		0, nic.Resources(), nic, svr)

	nic.Resources().Logger().Info("Web Server Started!")

	svr.Start()
}

func Resources(alias string) ifs.IResources {
	log := logger.NewLoggerImpl(&logger.FmtLogMethod{})
	log.SetLogLevel(ifs.Error_Level)
	res := resources.NewResources(log)

	res.Set(registry.NewRegistry())

	sec, err := ifs.LoadSecurityProvider(res)
	if err != nil {
		time.Sleep(time.Second * 10)
		panic(err.Error())
	}
	res.Set(sec)

	conf := &l8sysconfig.L8SysConfig{MaxDataSize: resources.DEFAULT_MAX_DATA_SIZE,
		RxQueueSize:              resources.DEFAULT_QUEUE_SIZE,
		TxQueueSize:              resources.DEFAULT_QUEUE_SIZE,
		LocalAlias:               alias,
		VnetPort:                 15151,
		KeepAliveIntervalSeconds: 30}
	res.Set(conf)

	res.Set(introspecting.NewIntrospect(res.Registry()))
	res.Set(manager.NewServices(res))

	return res
}

func WaitForSignal(resources ifs.IResources) {
	resources.Logger().Info("Waiting for os signal...")
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigs
	resources.Logger().Info("End signal received! ", sig)
}
