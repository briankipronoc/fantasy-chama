import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if not 'setToast(' in content and not 'toast?.type' in content:
        return
        
    print(f"Refactoring toasts in {filepath}")
    
    # 1. Add import toast from react-hot-toast if not there
    if 'from \'react-hot-toast\'' not in content:
        # insert after last import
        import_match = list(re.finditer(r'^import .*;$', content, re.MULTILINE))
        if import_match:
            last_import = import_match[-1]
            content = content[:last_import.end()] + '\nimport toast from \'react-hot-toast\';' + content[last_import.end():]
            
    # 2. Replace all setToast({ message: '...', type: 'success' }) with toast.success(...)
    content = re.sub(
        r'setToast\(\{\s*message:\s*([^\}]+?),\s*type:\s*\'success\'\s*\}\)',
        r'toast.success(\1)',
        content
    )
    # same for backticks
    content = re.sub(
        r'setToast\(\{\s*message:\s*`([^`]+)`,\s*type:\s*\'success\'\s*\}\)',
        r'toast.success(`\1`)',
        content
    )
    
    content = re.sub(
        r'setToast\(\{\s*message:\s*([^\}]+?),\s*type:\s*\'error\'\s*\}\)',
        r'toast.error(\1)',
        content
    )
    content = re.sub(
        r'setToast\(\{\s*message:\s*`([^`]+)`,\s*type:\s*\'error\'\s*\}\)',
        r'toast.error(`\1`)',
        content
    )
    
    content = re.sub(
        r'setToast\(\{\s*message:\s*([^\}]+?),\s*type:\s*\'info\'\s*\}\)',
        r'toast(\1)',
        content
    )

    # 3. Remove setTimeout(() => setToast(null)...)
    content = re.sub(r'setTimeout\(\(\) => setToast\(null\)[^;]+;', '', content)
    content = re.sub(r'setToast\(null\);', '', content)
    
    # 4. Remove const [toast, setToast] = useState...
    content = re.sub(r'const \[toast,\s*setToast\] = useState.*?null\);', '', content)
    
    # 5. Remove the huge fc-inline-toast block
    content = re.sub(r'\{toast && \(\s*<div className=\{clsx\(\s*"fc-inline-toast[\s\S]*?</div>\s*\)\}', '', content)
    content = re.sub(r'\{toast && \(\s*<div className="fc-inline-toast[\s\S]*?</div>\s*\)\}', '', content)

    with open(filepath, 'w') as f:
        f.write(content)

for root, dirs, files in os.walk('src/pages'):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))
