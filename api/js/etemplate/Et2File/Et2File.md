```html:preview

<et2-file 
    multiple
    image="cloud-upload" 
    label="Select files to upload" 
    helpText="Please check your files are complete before uploading"
></et2-file>
```

File allows the user to upload files to EGroupware. The uploaded files are processed on the server when the form is
submitted. As files are selected, they will be shown in a list with [FileItem](../et2-file-item)

## Examples

### Icon

Use `image` to specify the icon

```html:preview
<et2-file image="cloud-upload" ></et2-file>
```

### Limit files allowed

Use the `multiple`, `allow`, `maxFiles` and `maxFileSize` attributes to place restrictions on the files to be uploaded.

```html:preview
<et2-file image="image" allow="image/*" label="Choose an image"></et2-file>
<et2-file image="images" allow="image/*" multiple label="Choose images"></et2-file>
<et2-file maxFiles="3" label="Max. 3 files"></et2-file>
<et2-file maxFileSize="10000" label="Small files only"></et2-file>
```

### Inline

Normally the selected files are listed in a dropdown to avoid changing the flow of the rest of the page. Set `inline` to
not do that

```html:preview
<et2-file label="Choose an image" inline></et2-file>
```

### Display

Use the `display` attribute for different ways of showing results
```html:preview
<et2-file display="small" label="Small">
<et2-file-item slot="list" size="654321000" display="small" closable>Small file</et2-file-item>
</et2-file>
<et2-file display="list" label="List">
<et2-file-item slot="list" size="1234567" display="list" closable>File(s) shown as list</et2-file-item>
</et2-file>
```
