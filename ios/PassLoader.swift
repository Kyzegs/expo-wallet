import ExpoModulesCore
import PassKit

/// An Apple pass as sent from JS. Exactly one of `uri`, `base64` or `dataIndex` is set.
struct PassSource: Record {
  @Field var uri: String?
  @Field var headers: [String: String]?
  @Field var base64: String?
  /// Index into the `blobs` argument, which carries `Uint8Array`s (records can't).
  @Field var dataIndex: Int?
}

private enum PassInput: Sendable {
  case remote(URL, headers: [String: String])
  case file(URL)
  case bytes(Data)
}

enum PassLoader {
  /// Loads and parses the passes, downloading remote ones in parallel. Keeps the input order.
  static func load(_ sources: [PassSource], blobs: [Data]) async throws -> [PKPass] {
    let labels = sources.indices.map { sources.count > 1 ? "Apple pass at index \($0)" : "Apple pass" }
    let inputs = try sources.enumerated().map { index, source in
      try PassLoader.makeInput(source, blobs: blobs, label: labels[index])
    }

    return try await withThrowingTaskGroup(of: (Int, Data).self) { group in
      for (index, input) in inputs.enumerated() {
        let label = labels[index]
        group.addTask {
          let data = try await PassLoader.loadData(input, label: label)
          return (index, data)
        }
      }

      var passes = [PKPass?](repeating: nil, count: inputs.count)
      for try await (index, data) in group {
        do {
          passes[index] = try PKPass(data: data)
        } catch {
          throw WalletException.invalidPass("\(labels[index]) is not a valid .pkpass: \(error.localizedDescription)")
        }
      }
      return passes.compactMap { $0 }
    }
  }

  private static func makeInput(_ source: PassSource, blobs: [Data], label: String) throws -> PassInput {
    if let dataIndex = source.dataIndex {
      guard blobs.indices.contains(dataIndex) else {
        throw WalletException.invalidPass("\(label) has no data.")
      }
      return .bytes(blobs[dataIndex])
    }
    if let base64 = source.base64 {
      guard let data = decodeBase64(base64) else {
        throw WalletException.invalidPass("\(label) has invalid base64 data.")
      }
      return .bytes(data)
    }
    if let uri = source.uri {
      if uri.hasPrefix("/") {
        return .file(URL(fileURLWithPath: uri))
      }
      guard let url = URL(string: uri), let scheme = url.scheme?.lowercased() else {
        throw WalletException.invalidPass("\(label) has an invalid uri: \(uri)")
      }
      switch scheme {
      case "file":
        return .file(url)
      case "http", "https":
        return .remote(url, headers: source.headers ?? [:])
      default:
        throw WalletException.invalidPass("\(label) uri must be https://, file:// or data:, got \(scheme)://")
      }
    }
    throw WalletException.invalidPass("\(label) needs a uri, base64 or data.")
  }

  private static func loadData(_ input: PassInput, label: String) async throws -> Data {
    switch input {
    case .bytes(let data):
      return data

    case .file(let url):
      do {
        return try Data(contentsOf: url)
      } catch {
        throw WalletException.loadFailed("Couldn't read \(label) at \(url.path): \(error.localizedDescription)")
      }

    case .remote(let url, let headers):
      var request = URLRequest(url: url)
      request.setValue("application/vnd.apple.pkpass", forHTTPHeaderField: "Accept")
      for (name, value) in headers {
        request.setValue(value, forHTTPHeaderField: name)
      }
      let result: (Data, URLResponse)
      do {
        result = try await URLSession.shared.data(for: request)
      } catch {
        throw WalletException.loadFailed("Couldn't download \(label) from \(url): \(error.localizedDescription)")
      }
      let (data, response) = result
      if let status = (response as? HTTPURLResponse)?.statusCode, !(200..<300).contains(status) {
        throw WalletException.loadFailed("Downloading \(label) from \(url) failed with HTTP \(status).")
      }
      return data
    }
  }

  /// Accepts standard and URL-safe base64, with or without padding.
  static func decodeBase64(_ string: String) -> Data? {
    var base64 = string
      .replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
      .filter { !$0.isWhitespace }
    let remainder = base64.count % 4
    if remainder > 0 {
      base64 += String(repeating: "=", count: 4 - remainder)
    }
    return Data(base64Encoded: base64)
  }
}
