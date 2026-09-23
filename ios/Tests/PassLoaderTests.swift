import ExpoModulesCore
import XCTest

@testable import ExpoWallet

final class PassLoaderTests: XCTestCase {
  override func setUp() {
    super.setUp()
    StubURLProtocol.reset()
    URLProtocol.registerClass(StubURLProtocol.self)
  }

  override func tearDown() {
    URLProtocol.unregisterClass(StubURLProtocol.self)
    super.tearDown()
  }

  // MARK: - Base64

  func testDecodesStandardAndURLSafeBase64WithOrWithoutPadding() {
    XCTAssertEqual(PassLoader.decodeBase64("aGk="), Data("hi".utf8))
    XCTAssertEqual(PassLoader.decodeBase64("aGk"), Data("hi".utf8))
    XCTAssertEqual(PassLoader.decodeBase64("aG\nk="), Data("hi".utf8))
    XCTAssertEqual(PassLoader.decodeBase64("-_8"), Data([0xFB, 0xFF]))
    XCTAssertNil(PassLoader.decodeBase64("***"))
  }

  // MARK: - Invalid input

  func testRejectsASourceWithoutData() async {
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([PassSource()], blobs: [])
    }
  }

  func testRejectsInvalidBase64() async {
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(base64: "***")], blobs: [])
    }
  }

  func testRejectsAMissingBlob() async {
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(dataIndex: 1)], blobs: [Data()])
    }
  }

  func testRejectsUnsupportedSchemes() async {
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(uri: "ftp://example.com/pass.pkpass")], blobs: [])
    }
  }

  func testRejectsDataThatIsNotAPass() async {
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(base64: "aGk=")], blobs: [])
    }
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(dataIndex: 0)], blobs: [Data("hi".utf8)])
    }
  }

  // MARK: - Files

  func testReportsMissingFiles() async {
    await assertThrows("ERR_WALLET_LOAD_FAILED") {
      _ = try await PassLoader.load([makeSource(uri: "file:///nonexistent/pass.pkpass")], blobs: [])
    }
  }

  func testReadsFilesByURLAndPath() async throws {
    let file = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID()).pkpass")
    try Data("not a pass".utf8).write(to: file)
    defer { try? FileManager.default.removeItem(at: file) }

    // The file is read (not ERR_WALLET_LOAD_FAILED) and then rejected as an invalid pass.
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(uri: file.absoluteString)], blobs: [])
    }
    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load([makeSource(uri: file.path)], blobs: [])
    }
  }

  // MARK: - Downloads

  func testSendsHeadersWhenDownloading() async {
    StubURLProtocol.body = Data("not a pass".utf8)

    await assertThrows("ERR_WALLET_INVALID_PASS") {
      _ = try await PassLoader.load(
        [makeSource(uri: "https://wallet.test/pass.pkpass", headers: ["Authorization": "Bearer token"])],
        blobs: []
      )
    }
    XCTAssertEqual(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer token")
    XCTAssertEqual(StubURLProtocol.lastRequest?.value(forHTTPHeaderField: "Accept"), "application/vnd.apple.pkpass")
  }

  func testReportsHTTPErrors() async {
    StubURLProtocol.statusCode = 404

    await assertThrows("ERR_WALLET_LOAD_FAILED", messageContains: "HTTP 404") {
      _ = try await PassLoader.load([makeSource(uri: "https://wallet.test/missing.pkpass")], blobs: [])
    }
  }

  // MARK: - Helpers

  private func makeSource(
    uri: String? = nil,
    headers: [String: String]? = nil,
    base64: String? = nil,
    dataIndex: Int? = nil
  ) -> PassSource {
    // `@Field` wraps each value in a class, so the struct itself isn't mutated.
    let source = PassSource()
    source.uri = uri
    source.headers = headers
    source.base64 = base64
    source.dataIndex = dataIndex
    return source
  }

  private func assertThrows(
    _ code: String,
    messageContains message: String? = nil,
    file: StaticString = #filePath,
    line: UInt = #line,
    _ body: () async throws -> Void
  ) async {
    do {
      try await body()
      XCTFail("Expected \(code) to be thrown", file: file, line: line)
    } catch {
      XCTAssertEqual((error as? Exception)?.code, code, "\(error)", file: file, line: line)
      if let message {
        XCTAssertTrue("\(error)".contains(message), "\(error)", file: file, line: line)
      }
    }
  }
}

/// Answers requests to `wallet.test` without the network.
final class StubURLProtocol: URLProtocol {
  static var statusCode = 200
  static var body = Data()
  static var lastRequest: URLRequest?

  static func reset() {
    statusCode = 200
    body = Data()
    lastRequest = nil
  }

  override class func canInit(with request: URLRequest) -> Bool {
    request.url?.host == "wallet.test"
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    Self.lastRequest = request
    guard let url = request.url,
      let response = HTTPURLResponse(url: url, statusCode: Self.statusCode, httpVersion: "HTTP/1.1", headerFields: nil)
    else {
      client?.urlProtocol(self, didFailWithError: URLError(.badURL))
      return
    }
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: Self.body)
    client?.urlProtocolDidFinishLoading(self)
  }

  override func stopLoading() {}
}
