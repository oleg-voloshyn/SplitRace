function RichDescription({ html, className = '', style = {} }) {
  if (!html) {
    return null;
  }

  return (
    <div
      className={`sr-rich-description ${className}`.trim()}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default RichDescription;
