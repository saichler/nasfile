# NAS Remote File Manager

A professional, secure web-based file manager for NAS systems with a modern dual-pane interface. Built with the Layer 8 Ecosystem framework, this application provides an intuitive way to manage files remotely through your browser.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Go Version](https://img.shields.io/badge/go-%3E%3D1.21-blue.svg)

## Features

### 🎨 Modern User Interface
- **Dual-pane design** for efficient file management
- **Dark theme** optimized for extended use
- **Responsive layout** that works on various screen sizes
- **Drag-and-drop** support for intuitive file operations

### 📁 File Operations
- Browse directories with real-time updates
- Create new folders
- Copy, cut, and paste files/folders
- Rename files and folders
- Delete files and folders
- Multi-file selection (Ctrl/Cmd + click, Shift + click)
- Parent directory navigation
- Path-based navigation with manual path entry

### 🔒 Security
- **Authentication required** - Login screen with username/password
- **Bearer token authentication** for all API requests
- **HTTPS/TLS support** with certificate-based encryption
- Session management with automatic logout
- Secure credential handling

### 📊 File Information
- File size display with automatic unit conversion (B, KB, MB, GB, TB)
- File type indicators with icons
- Last modified timestamps
- Disk space information (free/total)
- File count statistics

### ⚡ Performance
- REST API based architecture
- Efficient file listing and operations
- Real-time status updates
- Progress indicators for long operations
- Background operation support

## Technology Stack

### Backend
- **Go** - Core server implementation
- **Layer 8 Ecosystem** - Framework providing:
  - Virtual networking (VNet/VNic)
  - Service management
  - REST API infrastructure
  - Security and authentication
  - Introspection and reflection

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5/CSS3** - Modern web standards
- **Font Awesome** - Icon library
- **Fetch API** - HTTP client

### Protocol
- **Protocol Buffers** - Data serialization
- **REST API** - HTTP/HTTPS endpoints
- **Bearer Token** - Authentication mechanism

## Installation

### Prerequisites
- Go 1.21 or higher
- Git

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/saichler/nasfile.git
cd nasfile
```

2. Install dependencies:
```bash
cd go
go mod download
```

3. Build the application:
```bash
cd nas/web
./build.sh
```

4. The binary will be created in the appropriate location

### Running the Application

1. Start the server:
```bash
./main
```

2. The server will start on port 7443 (HTTPS)

3. Access the web interface:
```
https://<your-server-ip>:7443/
```

4. Default credentials:
   - Username: `admin`
   - Password: `Admin123!`

## Project Structure

```
nasfile/
├── go/
│   ├── nas/
│   │   ├── actions/        # File operation handlers
│   │   ├── files/          # File listing service
│   │   ├── server/         # Main server setup
│   │   └── web/            # Web server and UI files
│   │       ├── main.go     # Application entry point
│   │       └── web/        # Frontend files
│   │           ├── index.html         # Login page
│   │           ├── filemanager.html   # File manager UI
│   │           ├── dualpane.js        # Core JavaScript
│   │           ├── dualpane.css       # Styling
│   │           ├── login.js           # Authentication
│   │           └── login.css          # Login styling
│   ├── types/              # Protocol buffer definitions
│   └── tests/              # Test files
├── proto/                  # Protocol buffer source files
└── README.md              # This file
```

## API Endpoints

### Authentication
- `POST /auth` - User authentication
  - Request: `{"user":"<username>", "pass":"<password>"}`
  - Response: `{"token":"<bearer-token>"}`

### File Operations
- `POST /files/0/Files` - List directory contents
- `POST /files/0/Actions` - Execute file operations:
  - `copy` - Copy files/folders
  - `cut` - Move files/folders
  - `delete` - Delete files/folders
  - `rename` - Rename files/folders
  - `newFolder` - Create new folder

All API requests require Bearer token authentication in the header:
```
Authorization: Bearer <token>
```

## Configuration

### Server Configuration
The server can be configured in `go/nas/server/server.go`:

```go
serverConfig := &server.RestServerConfig{
    Host:           protocol.MachineIP,
    Port:           7443,                    // HTTPS port
    Authentication: true,                    // Enable auth
    CertName:       "files",                // Certificate name
    Prefix:         "/files/",              // API prefix
}
```

### User Credentials
Default user is configured in `go/nas/server/server.go`:
```go
res := resources.NewResourcesWithUser(log, &l8api.AuthUser{
    User: "admin",
    Pass: "Admin123!"
})
```

## Security Considerations

1. **Change default credentials** in production
2. **Use valid SSL/TLS certificates** (not self-signed)
3. **Implement proper user management** for multi-user scenarios
4. **Set appropriate file system permissions**
5. **Use a reverse proxy** (nginx/Apache) in production
6. **Enable firewall rules** to restrict access
7. **Regular security updates** of dependencies

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + C` | Copy selected files |
| `Ctrl/Cmd + X` | Cut selected files |
| `Ctrl/Cmd + V` | Paste files |
| `Delete` | Delete selected files |
| `F2` | Rename selected file |
| `F5` | Refresh view |
| `Tab` | Switch between panes |
| `Enter` | Open folder/Navigate |

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Modern browsers with ES6+ support required.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Author

**Sharon Aicler**
- Email: saichler@gmail.com
- GitHub: [@saichler](https://github.com/saichler)

## Acknowledgments

Powered by **Layer 8 Ecosystem** - A comprehensive Go framework for building distributed applications with virtual networking, service management, and REST API capabilities.

## Support

For issues, questions, or suggestions, please open an issue on GitHub:
https://github.com/saichler/nasfile/issues

---

*Built with ❤️ using the Layer 8 Ecosystem*