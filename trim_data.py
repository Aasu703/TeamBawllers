import os

# Define the folders to clean
folders = [r'hybrid_dataset/real', r'hybrid_dataset/fake']
keep_limit = 500

for folder in folders:
    # Check if folder exists
    if not os.path.exists(folder):
        print(f"Error: Folder '{folder}' not found. Skipping.")
        continue

    # Get all files
    files = sorted(os.listdir(folder))
    
    # Check if we need to delete any
    if len(files) > keep_limit:
        files_to_delete = files[keep_limit:] # Select everything after the 500th file
        
        print(f"Cleaning {folder}...")
        print(f"Keeping 500 files, deleting {len(files_to_delete)} extras...")
        
        for f in files_to_delete:
            full_path = os.path.join(folder, f)
            os.remove(full_path)
            
        print("Done!")
    else:
        print(f"{folder} has {len(files)} files. No deletion needed.")