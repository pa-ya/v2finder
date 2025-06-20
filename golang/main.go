package main

import (
	"bufio"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/go-resty/resty/v2"
	"golang.org/x/net/proxy"
)

// Constants for V2Ray protocols
const (
	ProtocolVMess  = "vmess"
	ProtocolVLESS  = "vless"
	ProtocolTrojan = "trojan"
)

// Configuration Options
const (
	TestURL     = "https://www.google.com" // URL to test connectivity
	TestTimeout = 5 * time.Second          // Timeout for connection tests
)

// Channels
var (
	resultsChan = make(chan string, 100) // Buffered channel for results
	done        = make(chan bool)
)

// Mutex
var fileMutex sync.Mutex

// VmessConfig represents the structure of a VMess configuration.
type VmessConfig struct {
	V    string `json:"v"`    // Version
	Ps   string `json:"ps"`   // Remarks (description)
	Add  string `json:"add"`  // Address (IP or domain)
	Port string `json:"port"` // Port
	ID   string `json:"id"`   // User ID
	Aid  string `json:"aid"`  // Alter ID
	Net  string `json:"net"`  // Network (tcp, kcp, ws, h2, quic)
	Type string `json:"type"` // Type
	Host string `json:"host"` // Host
	Path string `json:"path"` // Path
	Tls  string `json:"tls"`  // TLS (tls, none)
	Sni  string `json:"sni"`  // Server Name Indication
}

// VlessConfig represents the structure of a VLESS configuration.
type VlessConfig struct {
	ID         string `json:"id"`
	Add        string `json:"add"`
	Port       string `json:"port"`
	Encryption string `json:"encryption"` // e.g., none
	Flow       string `json:"flow"`       // e.g., xtls-rprx-vision
	SNI        string `json:"sni"`        // Server Name Indication
	Path       string `json:"path"`       // Path
	Tls        string `json:"tls"`        // TLS (tls, none)
}

// TrojanConfig represents the structure of a Trojan configuration.
type TrojanConfig struct {
	Password string `json:"password"`
	Add      string `json:"add"`
	Port     string `json:"port"`
	SNI      string `json:"sni"` // Server Name Indication
	Tls      string `json:"tls"` // TLS (tls, none)
}

// -------------------------- Scrapers --------------------------

// scrapeWebsite scrapes server links from a website.
func scrapeWebsite(websiteURL string) ([]string, error) {
	client := resty.New()
	resp, err := client.R().Get(websiteURL)
	if err != nil {
		return nil, fmt.Errorf("error fetching website: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(resp.String()))
	if err != nil {
		return nil, fmt.Errorf("error parsing HTML: %w", err)
	}

	var serverLinks []string
	doc.Find("a[href*='vmess://'], a[href*='vless://'], a[href*='trojan://']").Each(func(i int, s *goquery.Selection) {
		link, exists := s.Attr("href")
		if exists {
			serverLinks = append(serverLinks, link)
		}
	})

	return serverLinks, nil
}

// scrapeRawGithub scrapes server links from a raw GitHub content URL (e.g., JSON).
func scrapeRawGithub(rawURL string) ([]string, error) {
	client := resty.New()
	resp, err := client.R().Get(rawURL)
	if err != nil {
		return nil, fmt.Errorf("error fetching raw content: %w", err)
	}

	contentType := resp.Header().Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var links []string
		if err := json.Unmarshal(resp.Body(), &links); err != nil {
			return nil, fmt.Errorf("error unmarshaling JSON: %w", err)
		}
		return links, nil
	}

	// Treat as plain text
	content := string(resp.Body())
	lines := strings.Split(content, "\n")
	var serverLinks []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "vmess://") || strings.HasPrefix(line, "vless://") || strings.HasPrefix(line, "trojan://") {
			serverLinks = append(serverLinks, line)
		}
	}
	return serverLinks, nil
}

// -------------------------- Parsers --------------------------

// parseVMessLink parses a VMess link and returns the configuration as a struct.
func parseVMessLink(link string) (*VmessConfig, error) {
	encodedConfig := strings.TrimPrefix(link, "vmess://")
	decodedConfig, err := base64.StdEncoding.DecodeString(encodedConfig)
	if err != nil {
		return nil, fmt.Errorf("base64 decode error: %w", err)
	}

	var config VmessConfig
	err = json.Unmarshal(decodedConfig, &config)
	if err != nil {
		return nil, fmt.Errorf("json unmarshal error: %w", err)
	}

	return &config, nil
}

// parseVLESSLink parses a VLESS link and returns the configuration as a struct.
func parseVLESSLink(link string) (*VlessConfig, error) {
	u, err := url.Parse(link)
	if err != nil {
		return nil, fmt.Errorf("url parse error: %w", err)
	}

	userInfo := u.User
	if userInfo == nil {
		return nil, fmt.Errorf("missing user info (UUID)")
	}
	id := userInfo.String()

	host := u.Host
	parts := strings.Split(host, ":")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid host format, expected address:port")
	}
	address := parts[0]
	port := parts[1]

	q := u.Query()
	encryption := q.Get("encryption")
	flow := q.Get("flow")
	tlsValue := q.Get("security")
	sni := q.Get("sni")
	path := q.Get("path")

	config := &VlessConfig{
		ID:         id,
		Add:        address,
		Port:       port,
		Encryption: encryption,
		Flow:       flow,
		SNI:        sni,
		Path:       path,
		Tls:        tlsValue,
	}
	return config, nil
}

// parseTrojanLink parses a Trojan link and returns the configuration as a struct.
func parseTrojanLink(link string) (*TrojanConfig, error) {
	u, err := url.Parse(link)
	if err != nil {
		return nil, fmt.Errorf("url parse error: %w", err)
	}

	userInfo := u.User
	if userInfo == nil {
		return nil, fmt.Errorf("missing user info (password)")
	}
	password, _ := userInfo.Password()

	host := u.Host
	parts := strings.Split(host, ":")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid host format, expected address:port")
	}
	address := parts[0]
	port := parts[1]

	q := u.Query()
	sni := q.Get("sni")
	tlsValue := q.Get("tls")

	config := &TrojanConfig{
		Password: password,
		Add:      address,
		Port:     port,
		SNI:      sni,
		Tls:      tlsValue,
	}
	return config, nil
}

// -------------------------- Connection Tester --------------------------

// testV2RayServer tests the connection to a target URL using the provided V2Ray server and protocol.
func testV2RayServer(serverAddress string, protocol string) bool {
	proxyURL, err := url.Parse(serverAddress)
	if err != nil {
		return false
	}

	dialer, err := proxy.FromURL(proxyURL, proxy.Direct) // proxy.Direct means no additional proxying
	if err != nil {
		return false
	}

	httpClient := &http.Client{
		Transport: &http.Transport{
			Dial:            dialer.Dial,
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, // Important for many V2Ray servers
		},
		Timeout: TestTimeout,
	}

	resp, err := httpClient.Get(TestURL)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	io.Copy(io.Discard, resp.Body) // Consume the response body

	return true
}

// -------------------------- Workers --------------------------
func worker(link string, wg *sync.WaitGroup) {
	defer wg.Done()

	protocol := getProtocol(link)

	switch protocol {
	case ProtocolVMess:
		config, err := parseVMessLink(link)
		if err != nil {
			log.Println("Error parsing VMess link:", err)
			return
		}
		serverAddress := fmt.Sprintf("socks5://%s:%s@%s:%s", config.ID, config.ID, config.Add, config.Port)
		if testV2RayServer(serverAddress, protocol) {
			resultsChan <- link
		}

	case ProtocolVLESS:
		config, err := parseVLESSLink(link)
		if err != nil {
			log.Println("Error parsing VLESS link:", err)
			return
		}
		var serverAddress string
		if config.Tls == "tls" {
			serverAddress = fmt.Sprintf("socks5://%s@%s:%s", config.ID, config.Add, config.Port)
		} else {
			serverAddress = fmt.Sprintf("http://%s@%s:%s", config.ID, config.Add, config.Port)
		}

		if testV2RayServer(serverAddress, protocol) {
			resultsChan <- link
		}

	case ProtocolTrojan:
		config, err := parseTrojanLink(link)
		if err != nil {
			log.Println("Error parsing Trojan link:", err)
			return
		}
		var serverAddress string
		if config.Tls == "tls" {
			serverAddress = fmt.Sprintf("socks5://%s@%s:%s", config.Password, config.Add, config.Port)
		} else {
			serverAddress = fmt.Sprintf("http://%s@%s:%s", config.Password, config.Add, config.Port)
		}
		if testV2RayServer(serverAddress, protocol) {
			resultsChan <- link
		}

	default:
		log.Println("Unsupported protocol:", protocol)
	}
}

// -------------------------- Result Writer --------------------------
func resultWriter() {
	file, err := os.Create("working_configs.txt")
	if err != nil {
		log.Fatal("Error creating file:", err)
	}
	defer file.Close()

	writer := bufio.NewWriter(file)

	for result := range resultsChan {
		fileMutex.Lock()
		_, err := writer.WriteString(result + "\n")
		if err != nil {
			log.Println("Error writing to file:", err)
		}
		fmt.Println("Working server:", result) // Keep console output too
		fileMutex.Unlock()
	}

	err = writer.Flush()
	if err != nil {
		log.Println("Error flushing writer:", err)
	}

	done <- true // Signal that the writer is done
}

// -------------------------- Helper Functions --------------------------

// getProtocol determines the protocol from the link.
func getProtocol(link string) string {
	if strings.HasPrefix(link, "vmess://") {
		return ProtocolVMess
	} else if strings.HasPrefix(link, "vless://") {
		return ProtocolVLESS
	} else if strings.HasPrefix(link, "trojan://") {
		return ProtocolTrojan
	}
	return ""
}

// -------------------------- Main Function --------------------------

func main() {
	// Define multiple source URLs
	sourceURLs := []string{
		"https://raw.githubusercontent.com/pojokan-id/v2ray-free/main/v2ray",
		"https://raw.githubusercontent.com/yebekhe/v2rayfree/main/v2",
		"https://raw.githubusercontent.com/freev2fly/freev2fly.github.io/gh-pages/_data/freeservers.json",
		//	"https://vless.fly.dev/", //This one seems unreliable
		"https://raw.githubusercontent.com/wzz1000/ClashR_for_Windows_Alpha/main/v2ray.config",
		"https://raw.githubusercontent.com/ALX-003/V2RAY-XRAYS-2024/main/V2RAY-XVLESS-XVmess/V2RAY-VMESS-VLESS-TROJAN-2024.txt",
		"https://raw.githubusercontent.com/FoxiYao/freesub/main/v2ray",
		"https://raw.githubusercontent.com/roshan9/v2ray/main/v2ray",
		"https://raw.githubusercontent.com/anam2812/v2ray-servers/main/v2ray-servers.txt",
		"https://raw.githubusercontent.com/aliaraz/v2ray-config/main/config.txt",
		// GitHub sources
		"https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt",
		"https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray",
		"https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
		"https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2",
		"https://raw.githubusercontent.com/ripaojiedian/freenode/main/sub",
		"https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt",
		"https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt",
		"https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/all3",
		"https://raw.githubusercontent.com/ts-sf/fly/main/v2",
		"https://raw.githubusercontent.com/freefq/free/master/v2",
		"https://raw.githubusercontent.com/ssrsub/ssr/master/v2ray",
		"https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/1/config.txt",
		"https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/2/config.txt",
		"https://raw.githubusercontent.com/Alvin9999/pac2/master/v2ray/3/config.txt",

		// Subscription links
		"https://sub.pmsub.me/base64",
		"https://raw.githubusercontent.com/tbbatbb/Proxy/master/dist/v2ray.config.txt",
		"https://raw.githubusercontent.com/changfengoss/pub/main/data/2024_01_17/cvjOPc.txt",
		"https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt",
		"https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription1.txt",
		"https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription2.txt",
		"https://raw.githubusercontent.com/w1770946466/Auto_proxy/main/Long_term_subscription3.txt",
		// Add more URLs as needed
	}

	var allLinks []string
	var linksMutex sync.Mutex // Mutex to protect the allLinks slice

	var wg sync.WaitGroup // Use a WaitGroup for the scrapers

	// Launch scrapers concurrently
	for _, sourceURL := range sourceURLs {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()
			var scrapedLinks []string
			var err error

			if strings.HasPrefix(url, "https://raw.githubusercontent.com/") { //Check Raw URL or Website
				scrapedLinks, err = scrapeRawGithub(url)
			} else {
				scrapedLinks, err = scrapeWebsite(url)
			}

			if err != nil {
				log.Printf("Error scraping %s: %v", url, err)
				return
			}

			linksMutex.Lock()
			allLinks = append(allLinks, scrapedLinks...)
			linksMutex.Unlock()
		}(sourceURL)
	}

	wg.Wait() // Wait for all scrapers to finish

	go resultWriter() // Start the result writer in a goroutine

	// Process the combined list of links
	var workerWg sync.WaitGroup
	for _, link := range allLinks {
		workerWg.Add(1)
		go worker(link, &workerWg) // Launch a worker goroutine for each server link
	}

	workerWg.Wait()    // Wait for all workers to complete
	close(resultsChan) // Close the results channel to signal the writer to exit

	<-done // Wait for the result writer to finish

	fmt.Println("Done.")
}
