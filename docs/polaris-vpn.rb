# Homebrew Formula for Polaris VPN
#
# To use this formula, create a tap repository at:
#   https://github.com/Divyo/homebrew-tap
# Place this file at: Formula/polaris-vpn.rb
# Then install with:
#   brew tap Divyo/tap
#   brew install polaris-vpn
#
# Or install directly from this file:
#   brew install --formula ./docs/polaris-vpn.rb

class PolarisVpn < Formula
  desc "Production-grade self-hosted VPN CLI with WireGuard, AmneziaWG, TLS & SSH tunnels"
  homepage "https://github.com/Divyo/polaris-vpn"
  url "https://registry.npmjs.org/polaris-vpn/-/polaris-vpn-1.3.0.tgz"
  # Update sha256 after publishing to npm:
  #   curl -s https://registry.npmjs.org/polaris-vpn/1.3.0 | python3 -c "import sys,json; print(json.load(sys.stdin)['dist']['shasum'])"
  sha256 "PLACEHOLDER_UPDATE_AFTER_NPM_PUBLISH"
  license "Apache-2.0"
  head "https://github.com/Divyo/polaris-vpn.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def post_install
    ohai "Polaris VPN installed successfully!"
    ohai "Quick start:"
    ohai "  polaris deploy --server root@<your-vps-ip>"
    ohai "  polaris start"
    ohai ""
    ohai "WireGuard (for system-wide tunnels) must be installed separately:"
    ohai "  On macOS: brew install wireguard-tools"
    ohai "  On Linux: sudo apt install wireguard"
  end

  test do
    # Basic smoke test: verify CLI parses --version correctly
    assert_match(/\d+\.\d+\.\d+/, shell_output("#{bin}/polaris --version"))
    # Verify polaris-server binary exists
    assert_predicate bin/"polaris-server", :exist?
  end
end
