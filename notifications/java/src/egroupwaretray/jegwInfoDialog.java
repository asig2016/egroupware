/**
 * EGroupware - Notifications Java Desktop App
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package notifications
 * @subpackage jdesk
 * @link http://www.egroupware.org
 * @author Stefan Werfling <stefan.werfling@hw-softwareentwicklung.de>
 * @author Maik Hüttner <maik.huettner@hw-softwareentwicklung.de>
 */

/*
 * jegwInfoDialog.java
 *
 * Created on 23.05.2009, 00:32:16
 */

package egroupwaretray;

import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Timer;
import javax.swing.JLabel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.border.Border;
import javax.swing.border.EmptyBorder;
import javax.swing.event.EventListenerList;

/**
 * jegwInfoDialog
 * 
 * @author Stefan Werfling <stefan.werfling@hw-softwareentwicklung.de>
 */
public class jegwInfoDialog extends javax.swing.JDialog implements ActionListener
{
    protected EventListenerList listenerList = new EventListenerList();
    
    private Timer egwttask		= new Timer(true);
    private Integer uptime		= 30;
    private String notifiyid	= "";

    private Boolean isRead  = false;

    /** Creates new form jegwInfoDialog */
    public jegwInfoDialog(java.awt.Frame parent, boolean modal) {
        super(parent, modal);
        initComponents();

		this.reSizeAndSetPos(400, 250);


        jegwInfoDialogTask task = new jegwInfoDialogTask();
        task.addActionListener(this);

		this.jBOpenApp.setText(jegwConst.getConstTag("egw_msg_infodialog_runapp"));
		
        this.isRead = false;

        // Jeder Sekunde
        this.egwttask.schedule(task, 1000, 1000);
    }

	public void reSizeAndSetPos(int w, int h)
	{
		// Dialog größe 
		// org w: 267, h: 155
		//this.setPreferredSize();
		this.setSize(new Dimension(w, h));
		
        // Desktop Größe/App größe
        Dimension desk = Toolkit.getDefaultToolkit().getScreenSize();
        Dimension app = this.getSize();
        
        Integer tw = desk.width - app.width;
        Integer th = desk.height - app.height - 26;
		
        this.setLocation(tw, th);
        this.setAlwaysOnTop(true);
	}
	
    public Boolean isInfoRead()
    {
        return this.isRead;
    }

    public void setInfoDialog(String text)
    {
		this.jLinfoBox.setSize(new Dimension(400, 230));
		this.reSizeAndSetPos(400, 250);
		//this.jLinfoBox.setText("<html>" + text);
		/*this.jLinfoBox.s
		Font labelFont = this.jLinfoBox.getFont();
		String labelText = this.jLinfoBox.getText();
		
		int stringWidth = this.jLinfoBox.getFontMetrics(labelFont).stringWidth(labelText);
		int componentWidth = this.jLinfoBox.getWidth();
		
		double widthRatio = (double)componentWidth / (double)stringWidth;
		
		int newFontSize = (int)(labelFont.getSize() * widthRatio);
		int componentHeight = this.jLinfoBox.getHeight();
		
		int fontSizeToUse = Math.min(newFontSize, componentHeight);
		
		this.jLinfoBox.setFont(new Font(labelFont.getName(), Font.PLAIN, fontSizeToUse));
		*/
		
        
		
		JLabel textArea = new JLabel();
		textArea.setSize(new Dimension(100, 175));
		textArea.setMaximumSize(new Dimension(100, Integer.MAX_VALUE));
		textArea.setText("<html>" + text);
		//textArea.setEditable(false);
		//textArea.setSize(new Dimension(400, 175));
		
		
		JScrollPane scrollPane = new JScrollPane();
		scrollPane.setBorder(new EmptyBorder(0, 0, 0, 0));
		scrollPane.getViewport().setView(textArea);
		scrollPane.setSize(new Dimension(380, 175));
		// wrap a scrollpane around it
		//JScrollPane scrollPane = new JScrollPane(textArea);
		
		
		jLinfoBox.add(scrollPane);
    }

    public void setNotifiyId(String id)
    {
        this.notifiyid = id;
    }

    public void addActionListener(ActionListener l)
    {
        listenerList.add(ActionListener.class, l);
    }

    protected void action(Object o, String command)
    {
        Object[] listeners = listenerList.getListenerList();

        ActionEvent e = new ActionEvent(o, ActionEvent.ACTION_PERFORMED, command);

        // Process the listeners last to first, notifying
        // those that are interested in this event
        for (int i = listeners.length-2; i>=0; i-=2) {
            if (listeners[i]==ActionListener.class) {
                ((ActionListener)listeners[i+1]).actionPerformed(e);
            }
        }
    }

    /** This method is called from within the constructor to
     * initialize the form.
     * WARNING: Do NOT modify this code. The content of this method is
     * always regenerated by the Form Editor.
     */
    @SuppressWarnings("unchecked")
    // <editor-fold defaultstate="collapsed" desc="Generated Code">//GEN-BEGIN:initComponents
    private void initComponents() {

        jPanel1 = new javax.swing.JPanel();
        jLinfoBox = new javax.swing.JLabel();
        jBOk = new javax.swing.JButton();
        jBOpenApp = new javax.swing.JButton();

        jPanel1.setName("jPanel1"); // NOI18N

        javax.swing.GroupLayout jPanel1Layout = new javax.swing.GroupLayout(jPanel1);
        jPanel1.setLayout(jPanel1Layout);
        jPanel1Layout.setHorizontalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 100, Short.MAX_VALUE)
        );
        jPanel1Layout.setVerticalGroup(
            jPanel1Layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGap(0, 100, Short.MAX_VALUE)
        );

        setDefaultCloseOperation(javax.swing.WindowConstants.DISPOSE_ON_CLOSE);
        setName("Form"); // NOI18N

        org.jdesktop.application.ResourceMap resourceMap = org.jdesktop.application.Application.getInstance(egroupwaretray.EgroupwareTrayApp.class).getContext().getResourceMap(jegwInfoDialog.class);
        jLinfoBox.setText(resourceMap.getString("jLinfoBox.text")); // NOI18N
        jLinfoBox.setAutoscrolls(true);
        jLinfoBox.setDoubleBuffered(true);
        jLinfoBox.setName("jLinfoBox"); // NOI18N

        jBOk.setFont(resourceMap.getFont("jBOk.font")); // NOI18N
        jBOk.setText(resourceMap.getString("jBOk.text")); // NOI18N
        jBOk.setName("jBOk"); // NOI18N
        jBOk.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                jBOkMouseClicked(evt);
            }
        });

        jBOpenApp.setFont(resourceMap.getFont("jBOpenApp.font")); // NOI18N
        jBOpenApp.setText(resourceMap.getString("jBOpenApp.text")); // NOI18N
        jBOpenApp.setName("jBOpenApp"); // NOI18N
        jBOpenApp.addMouseListener(new java.awt.event.MouseAdapter() {
            public void mouseClicked(java.awt.event.MouseEvent evt) {
                jBOpenAppMouseClicked(evt);
            }
        });

        javax.swing.GroupLayout layout = new javax.swing.GroupLayout(getContentPane());
        getContentPane().setLayout(layout);
        layout.setHorizontalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addGap(23, 23, 23)
                .addComponent(jBOk, javax.swing.GroupLayout.PREFERRED_SIZE, 73, javax.swing.GroupLayout.PREFERRED_SIZE)
                .addGap(18, 18, 18)
                .addComponent(jBOpenApp)
                .addContainerGap(32, Short.MAX_VALUE))
            .addComponent(jLinfoBox, javax.swing.GroupLayout.DEFAULT_SIZE, 251, Short.MAX_VALUE)
        );
        layout.setVerticalGroup(
            layout.createParallelGroup(javax.swing.GroupLayout.Alignment.LEADING)
            .addGroup(layout.createSequentialGroup()
                .addComponent(jLinfoBox, javax.swing.GroupLayout.DEFAULT_SIZE, 79, Short.MAX_VALUE)
                .addPreferredGap(javax.swing.LayoutStyle.ComponentPlacement.RELATED)
                .addGroup(layout.createParallelGroup(javax.swing.GroupLayout.Alignment.BASELINE)
                    .addComponent(jBOk)
                    .addComponent(jBOpenApp))
                .addContainerGap())
        );

        pack();
    }// </editor-fold>//GEN-END:initComponents

    private void jBOkMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jBOkMouseClicked
        this.isRead = true;
        this.setVisible(false);
    }//GEN-LAST:event_jBOkMouseClicked

    private void jBOpenAppMouseClicked(java.awt.event.MouseEvent evt) {//GEN-FIRST:event_jBOpenAppMouseClicked
        //this.isRead = true;
        
        // TODO add your handling code here:
        // App Öffnen
        this.action(this, "OPENAPP:" + this.notifiyid);
        this.setVisible(false);
    }//GEN-LAST:event_jBOpenAppMouseClicked


    /**
    * @param args the command line arguments
    */
    public static void main(String args[]) {
        java.awt.EventQueue.invokeLater(new Runnable() {
            public void run() {
                jegwInfoDialog dialog = new jegwInfoDialog(new javax.swing.JFrame(), true);
                dialog.addWindowListener(new java.awt.event.WindowAdapter() {
                    @Override
                    public void windowClosing(java.awt.event.WindowEvent e) {
                        System.exit(0);
                    }
                });
                dialog.setVisible(true);
            }
        });
    }

    // Variables declaration - do not modify//GEN-BEGIN:variables
    private javax.swing.JButton jBOk;
    private javax.swing.JButton jBOpenApp;
    private javax.swing.JLabel jLinfoBox;
    private javax.swing.JPanel jPanel1;
    // End of variables declaration//GEN-END:variables

    public void actionPerformed(ActionEvent e)
    {
		final jegwInfoDialog telement = this;
		
		EventQueue.invokeLater(new Runnable() {

          @Override
          public void run() {
				if(telement.uptime > 0)
				{
					telement.uptime--;
					telement.jBOk.setText(Integer.toString(telement.uptime) + " Ok");
				}

				if(telement.uptime <= 0)
				{
					telement.setVisible(false);
					telement.egwttask.cancel();
				}
			}
		});
    }
}