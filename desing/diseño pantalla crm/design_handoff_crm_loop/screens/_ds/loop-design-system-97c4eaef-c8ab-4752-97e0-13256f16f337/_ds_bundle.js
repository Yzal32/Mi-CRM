/* @ds-bundle: {"format":4,"namespace":"LoopDesignSystem_97c4ea","components":[{"name":"Avatar","sourcePath":"components/data/Avatar.jsx"},{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"DetailRow","sourcePath":"components/data/DetailRow.jsx"},{"name":"EmptyState","sourcePath":"components/data/EmptyState.jsx"},{"name":"ListItem","sourcePath":"components/data/ListItem.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SearchBar","sourcePath":"components/forms/SearchBar.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Icon","sourcePath":"components/foundation/Icon.jsx"},{"name":"FilterChips","sourcePath":"components/navigation/FilterChips.jsx"},{"name":"IconButton","sourcePath":"components/navigation/IconButton.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"ConfirmDialog","sourcePath":"components/overlay/ConfirmDialog.jsx"},{"name":"Modal","sourcePath":"components/overlay/Modal.jsx"}],"sourceHashes":{"components/data/Avatar.jsx":"bae78626ae97","components/data/Card.jsx":"2f85468756f0","components/data/DetailRow.jsx":"3813dd91f478","components/data/EmptyState.jsx":"6ac7b0825311","components/data/ListItem.jsx":"498f86f39238","components/data/StatCard.jsx":"bd895ae7875a","components/feedback/Badge.jsx":"c4f142f857d3","components/feedback/Toast.jsx":"3b6c2c68080b","components/forms/Button.jsx":"6cb99666f777","components/forms/Input.jsx":"65bb0a894e04","components/forms/SearchBar.jsx":"5f56db3df1f3","components/forms/Select.jsx":"5d83df547b16","components/forms/Switch.jsx":"985e7d9e8835","components/forms/Textarea.jsx":"a8640efe8aea","components/foundation/Icon.jsx":"a1984579b92a","components/navigation/FilterChips.jsx":"de3755fded24","components/navigation/IconButton.jsx":"e0bc5ae3dddf","components/navigation/Sidebar.jsx":"b8515bdd6c8d","components/navigation/TabBar.jsx":"672ebcb53401","components/navigation/TopBar.jsx":"3ac4e5763819","components/navigation/navItems.js":"5fd447df7ed4","components/overlay/ConfirmDialog.jsx":"903ff57314a0","components/overlay/Modal.jsx":"056dd1378113"},"inlinedExternals":[],"unexposedExports":[{"name":"navItems","sourcePath":"components/navigation/navItems.js"}]} */

(() => {

const __ds_ns = (window.LoopDesignSystem_97c4ea = window.LoopDesignSystem_97c4ea || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Avatar.jsx
try { (() => {
const hues = [165, 250, 300, 85, 20];
function hueFor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return hues[sum % hues.length];
}
function Avatar({
  name,
  size = 56
}) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const hue = hueFor(name || '');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--radius-circle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `oklch(0.92 0.05 ${hue})`,
      color: `oklch(0.45 0.12 ${hue})`,
      font: 'var(--text-body-medium)',
      fontSize: size * 0.38,
      flexShrink: 0
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding: 'var(--space-4)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const map = {
  new: {
    bg: 'var(--status-new-bg)',
    text: 'var(--status-new-text)',
    label: 'Nuevo'
  },
  contacted: {
    bg: 'var(--status-contacted-bg)',
    text: 'var(--status-contacted-text)',
    label: 'Contactado'
  },
  interested: {
    bg: 'var(--status-interested-bg)',
    text: 'var(--status-interested-text)',
    label: 'Interesado'
  },
  won: {
    bg: 'var(--status-won-bg)',
    text: 'var(--status-won-text)',
    label: 'Venta cerrada'
  },
  lost: {
    bg: 'var(--status-lost-bg)',
    text: 'var(--status-lost-text)',
    label: 'Perdido'
  },
  overdue: {
    bg: 'var(--color-alert-bg)',
    text: 'var(--color-alert-text)',
    label: 'Atrasado',
    border: 'var(--color-alert-border)'
  }
};
function Badge({
  status
}) {
  const s = map[status] || map.new;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      font: 'var(--text-caption)',
      color: s.text,
      background: s.bg,
      padding: '4px 12px',
      borderRadius: 'var(--radius-pill)',
      border: s.border ? '1px solid ' + s.border : 'none'
    }
  }, s.label);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: {
    padding: '8px 16px',
    height: 36,
    font: 'var(--text-secondary)'
  },
  md: {
    padding: '12px 20px',
    height: 44,
    font: 'var(--text-button)'
  },
  lg: {
    padding: '16px 24px',
    height: 52,
    font: 'var(--text-button)'
  }
};
function variantStyle(variant, disabled) {
  if (disabled) {
    return {
      background: 'var(--color-disabled-bg)',
      color: 'var(--color-disabled-text)',
      border: '1px solid var(--color-disabled-border)'
    };
  }
  if (variant === 'secondary') {
    return {
      background: 'var(--color-surface)',
      color: 'var(--color-primary)',
      border: '1px solid var(--color-border-strong)'
    };
  }
  if (variant === 'ghost') {
    return {
      background: 'transparent',
      color: 'var(--color-primary)',
      border: '1px solid transparent'
    };
  }
  return {
    background: 'var(--color-primary)',
    color: 'var(--color-primary-contrast)',
    border: '1px solid transparent'
  };
}
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const base = variantStyle(variant, disabled);
  const hoverBg = !disabled && variant === 'primary' && hover ? {
    background: 'var(--color-primary-hover)'
  } : {};
  const hoverSoft = !disabled && variant !== 'primary' && hover ? {
    background: 'var(--color-primary-soft)'
  } : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...sizes[size],
      ...base,
      ...hoverBg,
      ...hoverSoft,
      borderRadius: 'var(--radius-pill)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      transition: 'background 0.15s ease',
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  error,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-secondary)',
      color: 'var(--color-text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      font: 'var(--text-body)',
      color: disabled ? 'var(--color-disabled-text)' : 'var(--color-text)',
      background: disabled ? 'var(--color-disabled-bg)' : 'var(--color-surface)',
      border: '1px solid ' + (error ? 'var(--color-error-border)' : focused ? 'var(--color-primary)' : 'var(--color-border)'),
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      height: 44,
      boxSizing: 'border-box',
      outline: focused ? '3px solid var(--color-focus-ring)' : 'none',
      transition: 'border-color 0.15s ease'
    }
  }, rest)), error && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--color-error-text)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  value,
  onChange,
  options = [],
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-secondary)',
      color: 'var(--color-text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    disabled: disabled,
    style: {
      font: 'var(--text-body)',
      color: disabled ? 'var(--color-disabled-text)' : 'var(--color-text)',
      background: disabled ? 'var(--color-disabled-bg)' : 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      height: 44,
      boxSizing: 'border-box'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  label,
  checked,
  onChange,
  disabled = false
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body)',
      color: disabled ? 'var(--color-disabled-text)' : 'var(--color-text)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      width: 48,
      height: 28,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      opacity: 0,
      width: '100%',
      height: '100%',
      position: 'absolute',
      margin: 0,
      cursor: 'inherit'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 'var(--radius-pill)',
      background: disabled ? 'var(--color-disabled-bg)' : checked ? 'var(--color-primary)' : 'var(--color-border-strong)',
      transition: 'background 0.15s ease',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 23 : 3,
      width: 22,
      height: 22,
      borderRadius: 'var(--radius-circle)',
      background: 'var(--color-surface)',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left 0.15s ease',
      pointerEvents: 'none'
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function Textarea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
  error,
  disabled = false
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-secondary)',
      color: 'var(--color-text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("textarea", {
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    rows: rows,
    disabled: disabled,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      font: 'var(--text-body)',
      color: disabled ? 'var(--color-disabled-text)' : 'var(--color-text)',
      background: disabled ? 'var(--color-disabled-bg)' : 'var(--color-surface)',
      border: '1px solid ' + (error ? 'var(--color-error-border)' : focused ? 'var(--color-primary)' : 'var(--color-border)'),
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      boxSizing: 'border-box',
      resize: 'vertical',
      outline: focused ? '3px solid var(--color-focus-ring)' : 'none',
      fontFamily: 'var(--font-sans)'
    }
  }), error && /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--color-error-text)'
    }
  }, error));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/foundation/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function toPascalCase(kebab) {
  return kebab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.75,
  style,
  ...rest
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!window.lucide || !ref.current) return;
    const iconNode = window.lucide.icons && window.lucide.icons[toPascalCase(name)];
    if (!iconNode) return;
    const svg = window.lucide.createElement(iconNode, {
      width: size,
      height: size,
      'stroke-width': strokeWidth
    });
    // Only mutate our own <i>'s children, never let Lucide replace the
    // <i> node itself (createIcons() does that document-wide and races
    // with React's own reconciliation, causing removeChild crashes).
    ref.current.replaceChildren(svg);
  }, [name, size, strokeWidth]);
  return /*#__PURE__*/React.createElement("i", _extends({
    ref: ref,
    "data-lucide": name,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      color,
      flexShrink: 0,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/foundation/Icon.jsx", error: String((e && e.message) || e) }); }

// components/data/DetailRow.jsx
try { (() => {
function DetailRow({
  icon,
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      padding: 'var(--space-3) 0',
      borderBottom: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-primary)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--color-text-tertiary)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-medium)',
      color: 'var(--color-text)'
    }
  }, value)));
}
Object.assign(__ds_scope, { DetailRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DetailRow.jsx", error: String((e && e.message) || e) }); }

// components/data/EmptyState.jsx
try { (() => {
function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'users'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 12,
      padding: 'var(--space-10) var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 'var(--radius-circle)',
      background: 'var(--color-primary-soft)',
      color: 'var(--color-primary-soft-text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 28
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--text-section-title)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--color-text-secondary)',
      margin: 0,
      maxWidth: 320
    }
  }, message), actionLabel && /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    onClick: onAction,
    style: {
      marginTop: 8
    }
  }, actionLabel));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
const tones = {
  default: {
    bg: 'var(--color-surface)',
    accent: 'var(--color-primary)'
  },
  alert: {
    bg: 'var(--color-alert-bg)',
    accent: 'var(--color-alert-text)'
  },
  success: {
    bg: 'var(--status-won-bg)',
    accent: 'var(--status-won-text)'
  }
};
function StatCard({
  icon,
  label,
  value,
  tone = 'default'
}) {
  const t = tones[tone] || tones.default;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.bg,
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 140
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: t.accent,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-screen-title)',
      color: 'var(--color-text)'
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-secondary)',
      color: 'var(--color-text-secondary)'
    }
  }, label));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function Toast({
  message,
  variant = 'success'
}) {
  const color = variant === 'error' ? 'var(--color-error-text)' : 'var(--color-primary-soft-text)';
  const bg = variant === 'error' ? 'var(--color-error-bg)' : 'var(--color-primary-soft)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: '50%',
      bottom: 24,
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: bg,
      color,
      font: 'var(--text-body-medium)',
      padding: '12px 20px',
      borderRadius: 'var(--radius-pill)',
      boxShadow: 'var(--shadow-md)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: variant === 'error' ? 'alert-circle' : 'check',
    size: 18,
    color: color
  }), message);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchBar.jsx
try { (() => {
function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar cliente'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--color-surface-sunken)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-pill)',
      padding: '10px 16px',
      height: 44,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 18,
    color: "var(--color-text-tertiary)"
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    style: {
      border: 'none',
      background: 'transparent',
      outline: 'none',
      width: '100%',
      font: 'var(--text-body)',
      color: 'var(--color-text)'
    }
  }));
}
Object.assign(__ds_scope, { SearchBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/FilterChips.jsx
try { (() => {
function FilterChips({
  options = [],
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto'
    }
  }, options.map(o => {
    const active = o.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      onClick: () => onChange && onChange(o.value),
      style: {
        font: 'var(--text-secondary)',
        padding: '8px 16px',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        border: '1px solid ' + (active ? 'var(--color-primary)' : 'var(--color-border)'),
        background: active ? 'var(--color-primary-soft)' : 'var(--color-surface)',
        color: active ? 'var(--color-primary-soft-text)' : 'var(--color-text-secondary)',
        cursor: 'pointer'
      }
    }, o.label);
  }));
}
Object.assign(__ds_scope, { FilterChips });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/FilterChips.jsx", error: String((e && e.message) || e) }); }

// components/navigation/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 44,
  onClick
}) {
  const isPrimary = variant === 'primary';
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-label": label,
    title: label,
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--radius-circle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isPrimary ? 'var(--color-primary)' : 'var(--color-surface)',
      border: isPrimary ? 'none' : '1px solid var(--color-border-strong)',
      color: isPrimary ? 'var(--color-primary-contrast)' : 'var(--color-text)',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data/ListItem.jsx
try { (() => {
function ListItem({
  name,
  meta,
  status,
  overdue = false,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      cursor: onClick ? 'pointer' : 'default',
      border: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    size: 48
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body-medium)',
      color: 'var(--color-text)'
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-secondary)',
      color: 'var(--color-text-tertiary)'
    }
  }, meta), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 2
    }
  }, overdue && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    status: "overdue"
  }), status && /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    status: status
  }))), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "phone",
    label: "Llamar",
    onClick: e => e && e.stopPropagation && e.stopPropagation()
  }));
}
Object.assign(__ds_scope, { ListItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ListItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function TopBar({
  title,
  onBack
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 56,
      padding: '0 var(--space-4)',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0
    }
  }, onBack && /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    "aria-label": "Volver",
    style: {
      border: 'none',
      background: 'transparent',
      display: 'flex',
      color: 'var(--color-text)',
      cursor: 'pointer',
      padding: 8,
      marginLeft: -8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-left",
    size: 22
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-section-title)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, title));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/navItems.js
try { (() => {
const navItems = [{
  value: 'clients',
  label: 'Clientes',
  icon: 'users'
}, {
  value: 'today',
  label: 'Hoy',
  icon: 'calendar-check'
}, {
  value: 'stats',
  label: 'Estadísticas',
  icon: 'bar-chart-2'
}, {
  value: 'settings',
  label: 'Ajustes',
  icon: 'settings'
}];
Object.assign(__ds_scope, { navItems });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/navItems.js", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function Sidebar({
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      width: 220,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      padding: 'var(--space-4)',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-section-title)',
      color: 'var(--color-primary)',
      padding: '0 12px',
      marginBottom: 12
    }
  }, "Loop"), __ds_scope.navItems.map(it => {
    const isActive = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: isActive ? 'var(--color-primary-soft)' : 'transparent',
        color: isActive ? 'var(--color-primary-soft-text)' : 'var(--color-text-secondary)',
        font: 'var(--text-body-medium)',
        cursor: 'pointer',
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 20
    }), it.label);
  }));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
function TabBar({
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      justifyContent: 'space-around',
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0
    }
  }, __ds_scope.navItems.map(it => {
    const isActive = it.value === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        border: 'none',
        background: 'transparent',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
        cursor: 'pointer',
        minWidth: 64,
        padding: '4px 0'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 22
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--text-caption)'
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/overlay/ConfirmDialog.jsx
try { (() => {
function ConfirmDialog({
  open,
  danger = false,
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'oklch(0.2 0.01 80 / 0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)',
      zIndex: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-lg)',
      padding: 'var(--space-6)',
      width: '100%',
      maxWidth: 360,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--text-section-title)',
      color: danger ? 'var(--color-error-text)' : 'var(--color-text)',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--color-text-secondary)',
      margin: 0
    }
  }, message), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    onClick: onCancel,
    style: {
      flex: 1
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    onClick: onConfirm,
    style: {
      flex: 1,
      background: danger ? 'var(--color-error-border)' : undefined
    }
  }, confirmLabel))));
}
Object.assign(__ds_scope, { ConfirmDialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/ConfirmDialog.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Modal.jsx
try { (() => {
function Modal({
  open,
  title,
  onClose,
  children,
  footer
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'oklch(0.2 0.01 80 / 0.45)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
      boxShadow: 'var(--shadow-lg)',
      width: '100%',
      maxWidth: 480,
      maxHeight: '85vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-4) var(--space-5)',
      borderBottom: '1px solid var(--color-border)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--text-section-title)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Cerrar",
    style: {
      border: 'none',
      background: 'transparent',
      color: 'var(--color-text-secondary)',
      cursor: 'pointer',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 22
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-5)',
      overflowY: 'auto',
      flex: 1
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--space-5)',
      borderTop: '1px solid var(--color-border)'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Modal.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.DetailRow = __ds_scope.DetailRow;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ListItem = __ds_scope.ListItem;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SearchBar = __ds_scope.SearchBar;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.FilterChips = __ds_scope.FilterChips;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.ConfirmDialog = __ds_scope.ConfirmDialog;

__ds_ns.Modal = __ds_scope.Modal;

})();
