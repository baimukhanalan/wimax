Pod::Spec.new do |s|
  s.name           = 'MirrorSystemCapture'
  s.version        = '1.0.0'
  s.summary        = 'WIMAX system capture intents'
  s.description    = 'Bridges Siri and App Shortcuts into the WIMAX capture flow.'
  s.author         = 'WIMAX'
  s.homepage       = 'https://cognitivemirror.app'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
