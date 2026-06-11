# Content Security Policy for the Golazo SPA.
#
# Key choices:
#   script-src 'self'       — Vite builds all JS into /assets; no inline scripts needed.
#   style-src  'unsafe-inline' — React and some CSS-in-JS libraries inject inline styles.
#   img-src    'self' https: data: — team logo CDNs, og:image from news sites, data URIs.
#   connect-src — API calls back to self + WebSocket (ActionCable) on both ws:// and wss://.
#   object-src 'none'       — blocks Flash / plugins unconditionally.
#   frame-ancestors 'none'  — prevents the app from being embedded (clickjacking).
#
# Development relaxations:
#   script-src gets :unsafe_eval so Vite's HMR runtime works.
#   connect-src includes ws://localhost:* for the Vite dev server HMR socket.

Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.font_src    :self, :https, :data, "https://fonts.gstatic.com"
    policy.img_src     :self, :https, :data
    policy.object_src  :none
    policy.frame_ancestors :none

    # Inline styles are needed by React / emotion / Tailwind utilities injected
    # at runtime; tighten this to a nonce once the frontend is migrated away from
    # any dynamic style injection.
    # Google Fonts stylesheets are loaded from fonts.googleapis.com.
    policy.style_src :self, :unsafe_inline, "https://fonts.googleapis.com"

    if Rails.env.development?
      # Vite HMR requires eval + inline module scripts (React Refresh preamble)
      policy.script_src :self, :unsafe_eval, :unsafe_inline,
                        "http://#{ViteRuby.config.host_with_port}"
      policy.connect_src :self, :https,
                         "http://#{ViteRuby.config.host_with_port}",
                         "ws://#{ViteRuby.config.host_with_port}",
                         "ws://localhost:*",
                         "wss://localhost:*"
    else
      policy.script_src :self
      policy.connect_src :self, :https,
                         "wss://www.golazoapp.live",
                         "wss://golazoapp.live"
    end
  end
end
