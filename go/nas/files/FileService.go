package files

import (
	"os"
	"strings"
	"syscall"

	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/types/l8web"
	"github.com/saichler/l8utils/go/utils/web"
	"github.com/saichler/nasfile/go/types/files"
)

const (
	ServiceName = "Files"
	ServiceType = "FileService"
	ServiceArea = byte(0)
)

type FileService struct {
}

func Activate(vnic ifs.IVNic) {
	sla := ifs.NewServiceLevelAgreement(&FileService{}, ServiceName, ServiceArea, false, nil)
	ws := web.New(ServiceName, ServiceArea, &files.File{},
		&files.FileList{}, nil, nil, nil, nil, nil, nil, nil, nil)
	sla.SetWebService(ws)
	vnic.Resources().Services().Activate(sla, vnic)
}

func (this *FileService) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	vnic.Resources().Registry().Register(&files.File{})
	vnic.Resources().Registry().Register(&files.FileList{})
	return nil
}

func (this *FileService) DeActivate() error {
	return nil
}

func (this *FileService) Post(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	f, ok := pb.Element().(*files.File)
	if ok && f.IsDirectory {
		subPath := f.Path + "/" + f.Name
		if strings.HasPrefix(subPath, "//") {
			subPath = subPath[1:]
		}
		fileList, err := os.ReadDir(subPath)
		if err != nil {
			return object.NewError(err.Error())
		}
		list := &files.FileList{}
		list.TotalSpace, list.FreeSpace, err = Space(subPath)
		list.Fiels = make([]*files.File, 0)
		for _, file := range fileList {
			ff := &files.File{}
			ff.Name = file.Name()
			ff.Path = subPath
			ff.IsDirectory = file.IsDir()
			list.Fiels = append(list.Fiels, ff)

			info, err := file.Info()
			if err != nil {
				continue
			}
			ff.Size = info.Size()
			ff.Modified = info.ModTime().Unix()
		}
		return object.New(nil, list)
	}
	return object.New(nil, &l8web.L8Empty{})
}

func (this *FileService) Put(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}
func (this *FileService) Patch(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}
func (this *FileService) Delete(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}

func (this *FileService) Get(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}
func (this *FileService) GetCopy(pb ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return nil
}
func (this *FileService) Failed(pb ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return nil
}
func (this *FileService) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

func (this *FileService) WebService() ifs.IWebService {
	ws := web.New(ServiceName, ServiceArea, &files.File{},
		&files.FileList{}, nil, nil, nil, nil, nil, nil, nil, nil)
	return ws
}

func Space(path string) (totalSpace uint64, freeSpace uint64, err error) {
	var stat syscall.Statfs_t
	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, 0, err
	}

	totalSpace = stat.Blocks * uint64(stat.Bsize)
	freeSpace = stat.Bavail * uint64(stat.Bsize)

	return totalSpace, freeSpace, nil
}
