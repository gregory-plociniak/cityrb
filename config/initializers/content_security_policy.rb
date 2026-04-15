# Be sure to restart your server when you modify this file.

# Define an application-wide content security policy.
# See the Securing Rails Applications Guide for more information:
# https://guides.rubyonrails.org/security.html#content-security-policy-header

Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self, :https
    policy.font_src    :self, :https, :data
    policy.img_src     :self, :https, :data, :blob
    policy.object_src  :none
    policy.style_src   :self, :https, :unsafe_inline

    # 'unsafe-eval' is required by PixiJS for WebGL/WebGPU shader compilation.
    # This is a documented and accepted trade-off for game/graphics applications.
    # See: https://pixijs.com/llms.txt
    policy.script_src  :self, :https, :unsafe_eval

    # Allow PixiJS to create blob: URLs for worker scripts
    policy.worker_src  :self, :blob

    # Allow WebGL/WebGPU canvas data extraction
    policy.connect_src :self, :https, :blob
  end

  # Nonce for importmap inline script tag
  config.content_security_policy_nonce_generator = ->(request) { request.session.id.to_s }
  config.content_security_policy_nonce_directives = %w(script-src)
end
